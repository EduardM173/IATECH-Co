import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionUser } from '../auth/session.guard';
import { ActividadQueryDto } from './actividad-query.dto';

@Injectable()
export class SeguridadService {
  private readonly logger = new Logger(SeguridadService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async registrar(
    correo: string,
    ip: string,
    resultado: 'EXITOSO' | 'FALLIDO',
  ) {
    try {
      await this.prisma.client.eventoAcceso.create({
        data: {
          correo: correo.trim().toLowerCase().slice(0, 254),
          ip: ip.slice(0, 45),
          resultado,
        },
      });
    } catch {
      // Un fallo del registro no impide autenticar; no exponer datos sensibles en logs.
      this.logger.error('No se pudo registrar el evento de acceso');
    }
  }

  async listar(query: ActividadQueryDto, user: SessionUser) {
    if (user.categoria.nombre_categoria.toUpperCase() !== 'SEGURIDAD') {
      throw new ForbiddenException(
        'Solo el área de Seguridad puede consultar la actividad',
      );
    }
    const now = new Date();
    const where: Prisma.EventoAccesoWhereInput = {
      ...(query.periodo !== 'todos'
        ? {
            fecha: {
              gte: new Date(now.getTime() - Number(query.periodo) * 86400000),
            },
          }
        : {}),
      ...(query.q?.trim()
        ? {
            OR: [
              { correo: { contains: query.q.trim(), mode: 'insensitive' } },
              { ip: { contains: query.q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const filtered = {
      ...where,
      ...(query.resultado ? { resultado: query.resultado } : {}),
    };
    const [total, exitosos, fallidos, alertas] =
      await this.prisma.client.$transaction([
        this.prisma.client.eventoAcceso.count({ where: filtered }),
        this.prisma.client.eventoAcceso.count({
          where: { ...where, resultado: 'EXITOSO' },
        }),
        this.prisma.client.eventoAcceso.count({
          where: { ...where, resultado: 'FALLIDO' },
        }),
        this.prisma.client.eventoAcceso.groupBy({
          by: ['correo'],
          where: {
            resultado: 'FALLIDO',
            fecha: { gte: new Date(now.getTime() - 15 * 60000) },
          },
          _count: { _all: true },
          having: { correo: { _count: { gte: 5 } } },
          orderBy: { correo: 'asc' },
        }),
      ]);
    const totalPages = Math.ceil(total / query.pageSize);
    const page = Math.min(query.page, Math.max(1, totalPages));
    const rows = await this.prisma.client.eventoAcceso.findMany({
      where: filtered,
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * query.pageSize,
      take: query.pageSize,
    });
    const suspicious = new Set(alertas.map((item) => item.correo));
    return {
      data: rows.map((item) => ({
        ...item,
        alerta:
          item.resultado === 'FALLIDO' &&
          item.fecha.getTime() >= now.getTime() - 15 * 60000 &&
          suspicious.has(item.correo),
      })),
      meta: { total, totalPages, page, pageSize: query.pageSize },
      resumen: { exitosos, fallidos, alertas: alertas.length },
      actualizado: now.toISOString(),
    };
  }
}
