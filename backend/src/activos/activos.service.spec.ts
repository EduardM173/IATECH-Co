import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { ActivosService } from './activos.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('ActivosService: aislamiento por area', () => {
  it('incluye el id_categoria de la sesion al buscar por id', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      client: { inventario: { findFirst } },
    } as unknown as PrismaService;
    const service = new ActivosService(prisma);

    await expect(service.findOne('hardware', 7, 42)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_inventario: 42, id_categoria: 7 },
      }),
    );
  });
});
