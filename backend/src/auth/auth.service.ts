import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { signSession } from './session-token';
import { SessionUser } from './session.guard';
import { SeguridadService } from '../seguridad/seguridad.service';
import { hashPassword, verifyPassword } from './password';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SeguridadService) private readonly seguridad: SeguridadService,
  ) {}

  async register(registerDto: RegisterDto, requester: SessionUser) {
    const { nombre, contrasena, id_categoria } = registerDto;
    const correo = registerDto.correo.trim().toLowerCase();
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

    const contrasena_hash = await hashPassword(contrasena);
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
    const correo = loginDto.correo.trim().toLowerCase();
    const { contrasena } = loginDto;
    const user = await this.prisma.client.usuario.findUnique({
      where: { correo },
      include: { categoria: true },
    });
    if (!user || user.estado !== 'ACTIVO') {
      void this.seguridad.registrar(correo, ip, 'FALLIDO');
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!(await verifyPassword(contrasena, user.contrasena_hash))) {
      void this.seguridad.registrar(correo, ip, 'FALLIDO');
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const token = signSession(user.id_usuario);
    // La auditoria no bloquea la respuesta del login. registrar() captura y
    // registra internamente cualquier fallo de escritura.
    void this.seguridad.registrar(correo, ip, 'EXITOSO');
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
