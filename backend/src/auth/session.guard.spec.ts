import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SessionGuard } from './session.guard';
import { PrismaService } from '../prisma/prisma.service';
import { signSession } from './session-token';

jest.mock('database', () => ({ prisma: {} }));

describe('aislamiento de sesiones por host', () => {
  const previous = {
    AUTH_SECRET: process.env.AUTH_SECRET,
    TENANT_ROOT_DOMAINS: process.env.TENANT_ROOT_DOMAINS,
    API_HOSTNAMES: process.env.API_HOSTNAMES,
    TENANT_REQUIRE_SUBDOMAIN: process.env.TENANT_REQUIRE_SUBDOMAIN,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  };
  const id = 'a'.repeat(64);
  const user = {
    id_usuario: 42,
    id_categoria: 4,
    rol: 'ADMIN',
    estado: 'ACTIVO',
    categoria: { nombre_categoria: 'SEGURIDAD' },
  };
  let guard: SessionGuard;
  let session: { id: string; id_usuario: number; ambito: string; expira: Date; revocada: Date | null };

  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-secret-with-at-least-32-characters-long';
    process.env.TENANT_ROOT_DOMAINS = 'localhost';
    process.env.API_HOSTNAMES = 'localhost,127.0.0.1';
    process.env.TENANT_REQUIRE_SUBDOMAIN = 'true';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    session = {
      id,
      id_usuario: 42,
      ambito: 'central',
      expira: new Date(Date.now() + 60_000),
      revocada: null,
    };
    guard = new SessionGuard({
      client: {
        sesionAcceso: { findUnique: jest.fn(async () => session) },
        usuario: { findUnique: jest.fn(async () => user) },
      },
    } as unknown as PrismaService);
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  function context(scope: string, host: string, path: string, area?: string, method = 'GET', csrf = true) {
    session.ambito = scope;
    const request = {
      hostname: host,
      path,
      method,
      params: area ? { area } : {},
      headers: {
        origin: `http://${host}:5173`,
        cookie: `iatech_session=${signSession(42, id, scope)}`,
        ...(csrf ? { 'x-iatech-csrf': '1' } : {}),
      },
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('permite la sesión central en auth y bloquea inventario en el host central', async () => {
    await expect(guard.canActivate(context('central', 'localhost', '/auth/me'))).resolves.toBe(true);
    await expect(guard.canActivate(context('central', 'localhost', '/inventarios/seguridad', 'seguridad')))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('acepta solo el subdominio y el área que corresponden a la sesión', async () => {
    await expect(guard.canActivate(context('seguridad', 'seguridad.localhost', '/inventarios/seguridad', 'seguridad')))
      .resolves.toBe(true);
    await expect(guard.canActivate(context('seguridad', 'software.localhost', '/inventarios/software', 'software')))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(context('seguridad', 'localhost', '/auth/me')))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige CSRF en escrituras con cookie y revoca sesiones', async () => {
    await expect(guard.canActivate(context('seguridad', 'seguridad.localhost', '/auth/logout', undefined, 'POST', false)))
      .rejects.toBeInstanceOf(ForbiddenException);
    session.revocada = new Date();
    await expect(guard.canActivate(context('seguridad', 'seguridad.localhost', '/auth/me')))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('mantiene la ruta de un solo host cuando la configuración lo permite', async () => {
    process.env.TENANT_REQUIRE_SUBDOMAIN = 'false';
    await expect(guard.canActivate(context('central', 'localhost', '/inventarios/seguridad', 'seguridad')))
      .resolves.toBe(true);
    await expect(guard.canActivate(context('central', 'localhost', '/inventarios/software', 'software')))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
