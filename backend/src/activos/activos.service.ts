import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { AREA_CONFIG } from './areas.config';
import { AreaSlug } from './types/area-slug.type';
import { ListActivosQueryDto } from './dto/list-activos-query.dto';
import {
  InventarioListItemDto,
  PaginatedInventarioDto,
} from './dto/activo-response.dto';

type InventarioConCategoria = Prisma.InventarioGetPayload<{
  include: { categoria: true };
}>;

@Injectable()
export class ActivosService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll(
    area: AreaSlug,
    idCategoria: number,
    query: ListActivosQueryDto,
    rawQuery: Record<string, unknown>,
  ): Promise<PaginatedInventarioDto> {
    const where = this.buildWhere(area, idCategoria, query, rawQuery);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.inventario.findMany({
        where,
        include: { categoria: true },
        orderBy: [{ fecha_modificacion: 'desc' }, { id_inventario: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.inventario.count({ where }),
    ]);

    return {
      data: items.map((item) => this.toResponseDto(item, area)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(
    area: AreaSlug,
    idCategoria: number,
    id: number,
  ): Promise<InventarioListItemDto> {
    const item = await this.prisma.client.inventario.findFirst({
      where: {
        id_inventario: id,
        id_categoria: idCategoria,
      },
      include: { categoria: true },
    });

    if (!item) {
      throw new NotFoundException(
        `Registro ${id} no encontrado en el area ${area}`,
      );
    }

    return this.toResponseDto(item, area);
  }

  private buildWhere(
    area: AreaSlug,
    idCategoria: number,
    query: ListActivosQueryDto,
    rawQuery: Record<string, unknown>,
  ): Prisma.InventarioWhereInput {
    const config = AREA_CONFIG[area];
    const where: Record<string, unknown> = {
      id_categoria: idCategoria,
    };

    if (query.estado) where.estado = query.estado;

    if (query.q?.trim()) {
      const contains = { contains: query.q.trim(), mode: 'insensitive' };
      where.OR = [
        { nombre: contains },
        { responsable: contains },
        ...config.searchableFields.map((field) => ({ [field]: contains })),
      ];
    }

    for (const field of config.searchableFields) {
      const value = rawQuery[field];
      if (typeof value === 'string' && value.trim()) {
        where[field] = { contains: value.trim(), mode: 'insensitive' };
      }
    }

    return where;
  }

  private toResponseDto(
    item: InventarioConCategoria,
    area: AreaSlug,
  ): InventarioListItemDto {
    const raw = item as unknown as Record<string, unknown>;
    const detalle: Record<string, unknown> = {};
    for (const field of AREA_CONFIG[area].detailFields) {
      const value: unknown = raw[field];
      if (value !== null && value !== undefined) detalle[field] = value;
    }

    return {
      id_inventario: item.id_inventario,
      nombre: item.nombre,
      responsable: item.responsable,
      estado: item.estado,
      fecha_creacion: item.fecha_creacion,
      fecha_modificacion: item.fecha_modificacion,
      categoria: item.categoria,
      detalle,
    };
  }
}
