import { ForbiddenException, Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { ActividadQueryDto } from './actividad-query.dto';
import { SeguridadService } from './seguridad.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('SeguridadService: restricciones y disponibilidad', () => {
  it.each([
    'HARDWARE',
    'SOFTWARE',
    'REDES',
    'CALIDAD',
    'CLOUD',
    'BIG DATA ANALITICAS',
  ])('rechaza el área %s antes de consultar el historial', async (area) => {
    const transaction = jest.fn();
    const prisma = {
      client: { $transaction: transaction },
    } as unknown as PrismaService;
    const service = new SeguridadService(prisma);
    await expect(
      service.listar(new ActividadQueryDto(), {
        id_usuario: 1,
        id_categoria: 1,
        rol: 'ADMIN',
        categoria: { nombre_categoria: area },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('un fallo de auditoría no interrumpe la autenticación ni expone el error de base de datos', async () => {
    const create = jest
      .fn()
      .mockRejectedValue(new Error('detalle sensible de la conexión'));
    const prisma = {
      client: { eventoAcceso: { create } },
    } as unknown as PrismaService;
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      await expect(
        new SeguridadService(prisma).registrar(
          'demo@iatech.com',
          '127.0.0.1',
          'FALLIDO',
        ),
      ).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledWith(
        'No se pudo registrar el evento de acceso',
      );
    } finally {
      log.mockRestore();
    }
  });
});
