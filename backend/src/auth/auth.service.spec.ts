import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { scryptSync } from 'node:crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { SeguridadService } from '../seguridad/seguridad.service';
import { verifySessionClaims } from './session-token';

jest.mock('database', () => ({ prisma: {} }));

describe('login central y transferencia entre áreas', () => {
  const priorSecret = process.env.AUTH_SECRET;
  const password = 'clave-prueba-1234';
  const salt = 'test-salt';
  const user = {
    id_usuario: 42,
    nombre: 'Prueba Seguridad',
    correo: 'seguridad@iatech.test',
    contrasena_hash: `${salt}:${scryptSync(password, salt, 32).toString('hex')}`,
    id_categoria: 4,
    rol: 'ADMIN',
    estado: 'ACTIVO',
    fecha_creacion: new Date('2026-01-01T00:00:00Z'),
    categoria: { id_categoria: 4, nombre_categoria: 'SEGURIDAD' },
  };
  let service: AuthService;
  let sessions: Map<string, { id: string; id_usuario: number; ambito: string; sesion_origen?: string; expira: Date; revocada: Date | null }>;
  let grants: Map<string, { codigo_hash: string; id_usuario: number; sesion_origen: string; area: string; expira: Date }>;
  let registrar: jest.Mock;
  let currentUser: typeof user;

  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-secret-with-at-least-32-characters-long';
    sessions = new Map();
    grants = new Map();
    currentUser = user;
    registrar = jest.fn().mockResolvedValue(undefined);
    const client = {
      usuario: {
        findUnique: jest.fn(async ({ where }: { where: { correo?: string; id_usuario?: number } }) =>
          where.correo === user.correo || where.id_usuario === user.id_usuario ? currentUser : null),
      },
      sesionAcceso: {
        create: jest.fn(async ({ data }: { data: { id: string; id_usuario: number; ambito: string; sesion_origen?: string; expira: Date } }) => {
          const row = { ...data, revocada: null };
          sessions.set(data.id, row);
          return row;
        }),
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => sessions.get(where.id) ?? null),
        updateMany: jest.fn(async ({ where, data }: { where: { id?: string; sesion_origen?: string }; data: { revocada: Date } }) => {
          let count = 0;
          for (const row of sessions.values()) {
            if ((where.id && row.id === where.id) || (where.sesion_origen && row.sesion_origen === where.sesion_origen)) {
              row.revocada = data.revocada;
              count++;
            }
          }
          return { count };
        }),
      },
      transferenciaAcceso: {
        create: jest.fn(async ({ data }: { data: { codigo_hash: string; id_usuario: number; sesion_origen: string; area: string; expira: Date } }) => {
          grants.set(data.codigo_hash, data);
          return data;
        }),
        delete: jest.fn(async ({ where }: { where: { codigo_hash: string } }) => {
          const row = grants.get(where.codigo_hash);
          if (!row) throw { code: 'P2025' };
          grants.delete(where.codigo_hash);
          return row;
        }),
      },
    };
    const database = {
      client: {
        ...client,
        $transaction: async (callback: (tx: typeof client) => Promise<unknown>) => callback(client),
      },
    };
    service = new AuthService(
      database as unknown as PrismaService,
      { registrar } as unknown as SeguridadService,
    );
  });

  afterAll(() => {
    if (priorSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = priorSecret;
  });

  it('autentica una cuenta existente sin elegir área y rechaza contraseña incorrecta', async () => {
    await expect(service.login({ correo: user.correo, contrasena: 'incorrecta' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login({ correo: 'nadie@iatech.test', contrasena: password }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    const result = await service.login({ correo: user.correo, contrasena: password });
    expect(result.user.categoria.nombre_categoria).toBe('SEGURIDAD');
    expect(verifySessionClaims(result.token)?.scope).toBe('central');
    expect(registrar).toHaveBeenCalledWith(user.correo, 'desconocida', 'EXITOSO');
  });

  it('no crea sesión para un área no habilitada ni para un subdominio ajeno', async () => {
    currentUser = {
      ...user,
      categoria: { ...user.categoria, nombre_categoria: 'PENDIENTE' },
    };
    await expect(service.login({ correo: user.correo, contrasena: password }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(sessions.size).toBe(0);
    currentUser = user;
    await expect(service.login({ correo: user.correo, contrasena: password }, 'desconocida', 'software'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(sessions.size).toBe(0);
  });

  it('emite un código de un solo uso solo para el área autorizada', async () => {
    const central = await service.login({ correo: user.correo, contrasena: password });
    const sid = verifySessionClaims(central.token)?.sessionId ?? null;
    await expect(service.createTransfer(central.user, sid, 'software'))
      .rejects.toBeInstanceOf(ForbiddenException);
    const { code } = await service.createTransfer(central.user, sid, 'seguridad');
    await expect(service.exchangeTransfer(code, 'software'))
      .rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.exchangeTransfer(code, 'seguridad'))
      .rejects.toBeInstanceOf(UnauthorizedException);
    const second = await service.createTransfer(central.user, sid, 'seguridad');
    const area = await service.exchangeTransfer(second.code, 'seguridad');
    expect(verifySessionClaims(area.token)?.scope).toBe('seguridad');
    expect(area.user).not.toHaveProperty('contrasena_hash');
    await expect(service.exchangeTransfer(second.code, 'seguridad'))
      .rejects.toBeInstanceOf(UnauthorizedException);
    await service.revokeSession(sid);
    expect([...sessions.values()].find((row) => row.ambito === 'seguridad')?.revocada).toBeInstanceOf(Date);
  });

  it('rechaza códigos vencidos y sesiones centrales revocadas', async () => {
    const central = await service.login({ correo: user.correo, contrasena: password });
    const sid = verifySessionClaims(central.token)?.sessionId ?? null;
    const expired = await service.createTransfer(central.user, sid, 'seguridad');
    const grant = [...grants.values()][0];
    grant.expira = new Date(Date.now() - 1000);
    await expect(service.exchangeTransfer(expired.code, 'seguridad'))
      .rejects.toBeInstanceOf(UnauthorizedException);
    const pending = await service.createTransfer(central.user, sid, 'seguridad');
    await service.revokeSession(sid);
    await expect(service.exchangeTransfer(pending.code, 'seguridad'))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('cerrar desde el área revoca también la sesión central', async () => {
    const central = await service.login({ correo: user.correo, contrasena: password });
    const sourceId = verifySessionClaims(central.token)?.sessionId ?? null;
    const { code } = await service.createTransfer(central.user, sourceId, 'seguridad');
    const area = await service.exchangeTransfer(code, 'seguridad');
    const areaId = verifySessionClaims(area.token)?.sessionId ?? null;

    await service.revokeSession(areaId);

    expect(sessions.get(sourceId ?? '')?.revocada).toBeInstanceOf(Date);
    expect(sessions.get(areaId ?? '')?.revocada).toBeInstanceOf(Date);
    await expect(service.createTransfer(central.user, sourceId, 'seguridad'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
