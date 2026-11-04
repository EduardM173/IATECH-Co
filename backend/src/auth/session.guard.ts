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
import { verifySessionClaims } from './session-token';
import { assertTenantIdentity, originAllowed, requestTenant } from './tenant';

export interface SessionUser {
  id_usuario: number;
  id_categoria: number;
  rol: string;
  categoria: { nombre_categoria: string };
}

export interface AuthenticatedRequest extends Request {
  sessionUser: SessionUser;
  sessionId: string | null;
  sessionScope: string | null;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const cookie = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('iatech_session='));
    const bearer = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : null;
    const token = bearer ?? cookie?.slice('iatech_session='.length) ?? '';
    if (
      !bearer &&
      cookie &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      (!originAllowed(request.headers.origin) ||
        request.headers['x-iatech-csrf'] !== '1')
    )
      throw new ForbiddenException('Solicitud de sesión no autorizada');
    const claims = token ? verifySessionClaims(token) : null;
    if (!claims) throw new UnauthorizedException('Sesión inválida o vencida');
    if (claims.sessionId) {
      const session = await this.prisma.client.sesionAcceso.findUnique({
        where: { id: claims.sessionId },
      });
      if (
        !session || session.id_usuario !== claims.userId ||
        session.ambito !== claims.scope || session.revocada ||
        session.expira <= new Date()
      ) throw new UnauthorizedException('Sesión inválida o vencida');
    }

    const user = await this.prisma.client.usuario.findUnique({
      where: { id_usuario: claims.userId },
      select: {
        id_usuario: true,
        id_categoria: true,
        nombre: true,
        correo: true,
        rol: true,
        estado: true,
        fecha_creacion: true,
        categoria: true,
      },
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

    const tenant = requestTenant(request);
    const scope = tenant ?? 'central';
    if (claims.scope && claims.scope !== scope)
      throw new ForbiddenException('La sesión no pertenece a este acceso');
    if (scope === 'central') {
      if (
        !claims.sessionId ||
        (process.env.TENANT_REQUIRE_SUBDOMAIN === 'true' &&
          !['/auth/me', '/auth/logout', '/auth/transfer/create'].includes(request.path))
      ) throw new ForbiddenException('Abre el subdominio de tu área para continuar');
      if (process.env.TENANT_REQUIRE_SUBDOMAIN !== 'true')
        assertTenantIdentity(request, user.categoria.nombre_categoria);
    } else {
      assertTenantIdentity(request, user.categoria.nombre_categoria);
    }
    request.sessionUser = user;
    request.sessionId = claims.sessionId;
    request.sessionScope = claims.scope;
    return true;
  }
}
