import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { signSession } from '../src/auth/session-token';

jest.mock('database', () => ({
  prisma: {
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
    usuario: { findUnique: jest.fn() },
    activo: { findMany: jest.fn(), count: jest.fn() },
  },
}));

interface MockPrisma {
  $transaction: jest.Mock;
  usuario: { findUnique: jest.Mock };
  activo: { findMany: jest.Mock; count: jest.Mock };
}

function getPrismaMock(): MockPrisma {
  return jest.requireMock<{ prisma: MockPrisma }>('database').prisma;
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const previousSecret = process.env.AUTH_SECRET;

  beforeAll(() => {
    process.env.AUTH_SECRET =
      'integration-test-secret-with-more-than-32-characters';
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/activos/hardware rechaza solicitudes sin sesión', () => {
    return request(app.getHttpServer()).get('/activos/hardware').expect(401);
  });

  it('impide consultar activos de otra área', async () => {
    const prisma = getPrismaMock();
    prisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 1,
      id_categoria: 1,
      rol: 'USUARIO',
      estado: 'ACTIVO',
      categoria: { nombre_categoria: 'HARDWARE' },
    });
    await request(app.getHttpServer())
      .get('/activos/seguridad')
      .set('Authorization', `Bearer ${signSession(1)}`)
      .expect(403);
  });

  it('permite listar activos de su área', async () => {
    const prisma = getPrismaMock();
    prisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 1,
      id_categoria: 1,
      rol: 'USUARIO',
      estado: 'ACTIVO',
      categoria: { nombre_categoria: 'HARDWARE' },
    });
    prisma.activo.findMany.mockReturnValue(Promise.resolve([]));
    prisma.activo.count.mockReturnValue(Promise.resolve(0));
    prisma.$transaction.mockResolvedValue([[], 0]);

    await request(app.getHttpServer())
      .get('/activos/hardware?page=1&pageSize=20')
      .set('Authorization', `Bearer ${signSession(1)}`)
      .expect(200, {
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });
    expect(prisma.activo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }) as object,
    );
  });

  it('rechaza un tamaño de página inválido', async () => {
    const prisma = getPrismaMock();
    prisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 1,
      id_categoria: 1,
      rol: 'USUARIO',
      estado: 'ACTIVO',
      categoria: { nombre_categoria: 'HARDWARE' },
    });
    await request(app.getHttpServer())
      .get('/activos/hardware?pageSize=abc')
      .set('Authorization', `Bearer ${signSession(1)}`)
      .expect(400);
    expect(prisma.activo.findMany).not.toHaveBeenCalled();
  });
});
