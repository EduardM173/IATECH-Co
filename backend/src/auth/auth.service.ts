import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { signSession } from './session-token';
import { SessionUser } from './session.guard';
import { SeguridadService } from '../seguridad/seguridad.service';

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

  async login(loginDto: LoginDto, ip = 'desconocida') {
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

    const token = signSession(user.id_usuario);
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
}
