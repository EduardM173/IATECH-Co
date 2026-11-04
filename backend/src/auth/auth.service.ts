import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { signSession } from './session-token';
import { SessionUser } from './session.guard';
import { SeguridadService } from '../seguridad/seguridad.service';
import { AREA_NAMES } from '../inventarios/inventory.config';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SeguridadService) private readonly seguridad: SeguridadService,
  ) {}

  async register(registerDto: RegisterDto, requester: SessionUser) {
    const { nombre, correo, contrasena, id_categoria } = registerDto;
    if (requester.rol !== 'ADMIN' || requester.id_categoria !== id_categoria) {
      throw new ForbiddenException(
        'Solo un administrador del área puede registrar usuarios',
      );
    }
    const existingUser = await this.prisma.client.usuario.findUnique({
      where: { correo },
    });
    if (existingUser) {
      throw new BadRequestException('El correo ya está registrado');
    }

    const categoria = await this.prisma.client.categoria.findUnique({
      where: { id_categoria },
    });
    if (!categoria) {
      throw new BadRequestException('La categoría no existe');
    }

    const salt = randomBytes(16).toString('hex');
    const contrasena_hash = `${salt}:${scryptSync(contrasena, salt, 32).toString('hex')}`;
    const user = await this.prisma.client.usuario.create({
      data: {
        nombre,
        correo,
        contrasena_hash,
        id_categoria,
        rol: 'USUARIO',
        estado: 'ACTIVO',
      },
      select: {
        id_usuario: true,
        nombre: true,
        correo: true,
        id_categoria: true,
        rol: true,
        estado: true,
        fecha_creacion: true,
      },
    });

    return { message: 'Usuario registrado exitosamente', user };
  }

  async login(
    loginDto: LoginDto,
    ip = 'desconocida',
    tenant: string | null = null,
  ) {
    const { correo, contrasena } = loginDto;
    const user = await this.prisma.client.usuario.findUnique({
      where: { correo },
      include: { categoria: true },
    });
    if (!user || user.estado !== 'ACTIVO') {
      await this.seguridad.registrar(correo, ip, 'FALLIDO');
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const [salt, key] = user.contrasena_hash.split(':');
    if (!salt || !key || !/^[a-f0-9]{64}$/i.test(key)) {
      await this.seguridad.registrar(correo, ip, 'FALLIDO');
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const expected = Buffer.from(key, 'hex');
    const actual = scryptSync(contrasena, salt, expected.length);
    if (!timingSafeEqual(actual, expected)) {
      await this.seguridad.registrar(correo, ip, 'FALLIDO');
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const area = Object.entries(AREA_NAMES).find(
      ([, name]) => name === user.categoria.nombre_categoria,
    )?.[0];
    if (!area) throw new ForbiddenException('Acceso no disponible para esta cuenta');
    if (tenant && tenant !== area)
      throw new ForbiddenException('No tienes acceso a esta área');
    const token = await this.issueSession(user.id_usuario, tenant ?? 'central');
    await this.seguridad.registrar(correo, ip, 'EXITOSO');
    const safeUser = {
      id_usuario: user.id_usuario,
      nombre: user.nombre,
      correo: user.correo,
      id_categoria: user.id_categoria,
      rol: user.rol,
      estado: user.estado,
      fecha_creacion: user.fecha_creacion,
      categoria: user.categoria,
    };
    return { message: 'Login exitoso', user: safeUser, token };
  }

  private async issueSession(userId: number, scope: string, sourceId?: string) {
    const id = randomBytes(32).toString('hex');
    await this.prisma.client.sesionAcceso.create({
      data: {
        id,
        id_usuario: userId,
        ambito: scope,
        sesion_origen: sourceId,
        expira: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
    });
    return signSession(userId, id, scope);
  }

  async createTransfer(user: SessionUser, sessionId: string | null, area: string) {
    if (!sessionId || AREA_NAMES[area] !== user.categoria.nombre_categoria)
      throw new ForbiddenException('No tienes acceso a esta área');
    const source = await this.prisma.client.sesionAcceso.findUnique({
      where: { id: sessionId },
    });
    if (!source || source.ambito !== 'central' || source.revocada || source.expira <= new Date())
      throw new ForbiddenException('Sesión central no disponible');
    const code = randomBytes(32).toString('base64url');
    await this.prisma.client.transferenciaAcceso.create({
      data: {
        codigo_hash: createHash('sha256').update(code).digest('hex'),
        id_usuario: user.id_usuario,
        sesion_origen: sessionId,
        area,
        expira: new Date(Date.now() + 60_000),
      },
    });
    return { code, expiresIn: 60 };
  }

  async exchangeTransfer(code: string, area: string | null) {
    if (!area || !/^[A-Za-z0-9_-]{43}$/.test(code))
      throw new UnauthorizedException('Autorización inválida o vencida');
    const hash = createHash('sha256').update(code).digest('hex');
    const grant = await this.prisma.client.transferenciaAcceso
      .delete({ where: { codigo_hash: hash } })
      .catch((error: unknown) => {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025')
          return null;
        throw error;
      });
    if (!grant || grant.area !== area || grant.expira <= new Date())
      throw new UnauthorizedException('Autorización inválida o vencida');
    const [source, user] = await Promise.all([
      this.prisma.client.sesionAcceso.findUnique({ where: { id: grant.sesion_origen } }),
      this.prisma.client.usuario.findUnique({
        where: { id_usuario: grant.id_usuario },
        select: {
          id_usuario: true,
          nombre: true,
          correo: true,
          id_categoria: true,
          rol: true,
          estado: true,
          fecha_creacion: true,
          categoria: true,
        },
      }),
    ]);
    if (
      !source || source.revocada || source.expira <= new Date() ||
      source.ambito !== 'central' || source.id_usuario !== grant.id_usuario ||
      !user || user.estado !== 'ACTIVO' || AREA_NAMES[area] !== user.categoria.nombre_categoria
    ) throw new UnauthorizedException('Autorización inválida o vencida');
    const token = await this.issueSession(user.id_usuario, area, grant.sesion_origen);
    return {
      user: {
        id_usuario: user.id_usuario,
        nombre: user.nombre,
        correo: user.correo,
        id_categoria: user.id_categoria,
        rol: user.rol,
        estado: user.estado,
        fecha_creacion: user.fecha_creacion,
        categoria: user.categoria,
      },
      token,
    };
  }

  async revokeSession(sessionId: string | null) {
    if (!sessionId) return;
    const now = new Date();
    await this.prisma.client.$transaction(async (tx) => {
      const session = await tx.sesionAcceso.findUnique({ where: { id: sessionId } });
      if (!session) return;
      const sourceId = session.ambito === 'central' ? session.id : session.sesion_origen;
      const source = sourceId
        ? await tx.sesionAcceso.findUnique({ where: { id: sourceId } })
        : null;
      if (sourceId && source?.ambito === 'central' && source.id_usuario === session.id_usuario) {
        await tx.sesionAcceso.updateMany({
          where: { id: sourceId, revocada: null },
          data: { revocada: now },
        });
        await tx.sesionAcceso.updateMany({
          where: { sesion_origen: sourceId, revocada: null },
          data: { revocada: now },
        });
        return;
      }
      await tx.sesionAcceso.updateMany({
        where: { id: sessionId, revocada: null },
        data: { revocada: now },
      });
    });
  }
}
