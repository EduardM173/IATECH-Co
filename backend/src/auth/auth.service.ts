import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  // Utilidad nativa de Node para hashear contraseñas (sin usar librerias externas como bcrypt)
  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 32).toString('hex');
    return `${salt}:${hash}`;
  }

  // Utilidad para verificar la contraseña
  private verifyPassword(password: string, storedHash: string): boolean {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    
    const [salt, key] = parts;
    const hashBuffer = crypto.scryptSync(password, salt, 32);
    const keyBuffer = Buffer.from(key, 'hex');
    
    if (hashBuffer.length !== keyBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, keyBuffer);
  }

  async register(registerDto: RegisterDto) {
    const { nombre, correo, contrasena, id_categoria, rol } = registerDto;

    // 1. Validar que el usuario no exista
    const existingUser = await this.prisma.usuario.findUnique({
      where: { correo },
    });

    if (existingUser) {
      throw new BadRequestException('El correo ya está registrado');
    }

    // 2. Hashear contraseña
    const contrasena_hash = this.hashPassword(contrasena);

    // 3. Crear el usuario en BD
    const user = await this.prisma.usuario.create({
      data: {
        nombre,
        correo,
        contrasena_hash,
        id_categoria,
        rol: rol || 'USUARIO',
        estado: 'ACTIVO',
      },
    });

    // 4. Retornar el usuario sin la contraseña
    const { contrasena_hash: _, ...userWithoutPassword } = user;
    return {
      message: 'Usuario registrado exitosamente',
      user: userWithoutPassword,
    };
  }

  async login(loginDto: LoginDto) {
    const { correo, contrasena } = loginDto;

    const user = await this.prisma.usuario.findUnique({
      where: { correo },
      include: { categoria: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 2. Verificar estado activo
    if (user.estado !== 'ACTIVO') {
      throw new UnauthorizedException('El usuario está inactivo');
    }

    // 3. Verificar contraseña
    const isValid = this.verifyPassword(contrasena, user.contrasena_hash);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 4. Generar un token básico nativo (Para hacerlo sin librerias externas como @nestjs/jwt)
    // En producción se recomienda usar JWT real.
    const tokenPayload = Buffer.from(JSON.stringify({ id: user.id_usuario, correo: user.correo, rol: user.rol })).toString('base64');
    const signature = crypto.createHmac('sha256', '6546546546456546543654643').update(tokenPayload).digest('base64');
    const token = `${tokenPayload}.${signature}`;

    const { contrasena_hash, ...userWithoutPassword } = user;

    return {
      message: 'Login exitoso',
      user: userWithoutPassword,
      token,
    };
  }
}
