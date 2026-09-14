import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { AREA_CONFIG } from './areas.config';
import { AreaSlug } from './types/area-slug.type';
import { ListActivosQueryDto } from './dto/list-activos-query.dto';
import { ActivoListItemDto, PaginatedActivosDto } from './dto/activo-response.dto';

const DETALLE_INCLUDE = {
  categoria: true,
  hardware: true,
  software: true,
  redes: true,
  seguridad: true,
  calidad: true,
  cloud: true,
  bigdata: true,
} satisfies Prisma.ActivoInclude;

type ActivoWithDetalle = Prisma.ActivoGetPayload<{ include: typeof DETALLE_INCLUDE }>;

@Injectable()
export class ActivosService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll(
    area: AreaSlug,
    query: ListActivosQueryDto,
    rawQuery: Record<string, unknown>,
  ): Promise<PaginatedActivosDto> {
    const where = this.buildWhere(area, query, rawQuery);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [activos, total] = await this.prisma.client.$transaction([
      this.prisma.client.activo.findMany({
        where,
        include: DETALLE_INCLUDE,
        orderBy: { id_activo: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.client.activo.count({ where }),
    ]);

    return {
      data: activos.map((activo) => this.toResponseDto(activo, area)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(area: AreaSlug, id: number): Promise<ActivoListItemDto> {
    const activo = await this.prisma.client.activo.findFirst({
      where: {
        id_activo: id,
        categoria: { nombre_categoria: AREA_CONFIG[area].nombreCategoria },
      },
      include: DETALLE_INCLUDE,
    });

    if (!activo) {
      throw new NotFoundException(`Activo ${id} no encontrado en el area ${area}`);
    }

    return this.toResponseDto(activo, area);
  }

  async findByCodigo(area: AreaSlug, codigo: string): Promise<ActivoListItemDto> {
    const activo = await this.prisma.client.activo.findFirst({
      where: {
        codigo,
        categoria: { nombre_categoria: AREA_CONFIG[area].nombreCategoria },
      },
      include: DETALLE_INCLUDE,
    });

    if (!activo) {
      throw new NotFoundException(`Activo con codigo "${codigo}" no encontrado en el area ${area}`);
    }

    return this.toResponseDto(activo, area);
  }

  // Prisma tipa el filtro de cada relacion de detalle con un tipo distinto por modelo
  // (HardwareWhereInput, SoftwareWhereInput, ...). Como "area" recorre las 7 variantes en
  // runtime, se arma el objeto where sin tipar estrictamente esa parte dinamica y se castea
  // al final; los campos que se leen vienen siempre de AREA_CONFIG[area].searchableFields,
  // que si esta tipado contra el schema real.
  private buildWhere(
    area: AreaSlug,
    query: ListActivosQueryDto,
    rawQuery: Record<string, unknown>,
  ): Prisma.ActivoWhereInput {
    const config = AREA_CONFIG[area];

    const detalleFilters: Record<string, unknown> = {};
    for (const field of config.searchableFields) {
      const value = rawQuery[field];
      if (typeof value === 'string' && value.trim() !== '') {
        detalleFilters[field] = { contains: value, mode: 'insensitive' };
      }
    }

    const where: Record<string, unknown> = {
      categoria: { nombre_categoria: config.nombreCategoria },
    };

    if (query.estado) {
      where.estado = query.estado;
    }

    if (query.q) {
      where.OR = [
        { codigo: { contains: query.q, mode: 'insensitive' } },
        { descripcion: { contains: query.q, mode: 'insensitive' } },
        ...config.searchableFields.map((field) => ({
          [area]: { is: { [field]: { contains: query.q, mode: 'insensitive' } } },
        })),
      ];
    }

    if (Object.keys(detalleFilters).length > 0) {
      where[area] = { is: detalleFilters };
    }

    return where as Prisma.ActivoWhereInput;
  }

  private toResponseDto(activo: ActivoWithDetalle, area: AreaSlug): ActivoListItemDto {
    const detalleRaw = (activo[area] ?? {}) as Record<string, unknown>;
    const detalle: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(detalleRaw)) {
      if (key !== 'id_activo') {
        detalle[key] = value;
      }
    }

    return {
      id_activo: activo.id_activo,
      codigo: activo.codigo,
      descripcion: activo.descripcion,
      estado: activo.estado,
      fecha_registro: activo.fecha_registro,
      categoria: activo.categoria,
      detalle,
    };
  }
}
