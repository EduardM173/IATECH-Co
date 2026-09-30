import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AREA_CONFIG } from '../activos/areas.config';
import { AreaSlug } from '../activos/types/area-slug.type';
import { PrismaService } from '../prisma/prisma.service';
import { verifySession } from './session-token';

export interface SessionUser {
  id_usuario: number;
  id_categoria: number;
  rol: string;
  categoria: { nombre_categoria: string };
}

export interface AuthenticatedRequest extends Request {
  sessionUser: SessionUser;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';
    const userId = token ? verifySession(token) : null;
    if (!userId) throw new UnauthorizedException('Sesión inválida o vencida');

    const user = await this.prisma.client.usuario.findUnique({
      where: { id_usuario: userId },
      include: { categoria: true },
    });
    if (!user || user.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Sesión inválida o vencida');
    }

    const area = request.params.area as AreaSlug | undefined;
    if (
      area &&
      area in AREA_CONFIG &&
      user.categoria.nombre_categoria !== AREA_CONFIG[area].nombreCategoria
    ) {
      throw new ForbiddenException('No tienes acceso a esta área');
    }

    request.sessionUser = user;
    return true;
  }
}
