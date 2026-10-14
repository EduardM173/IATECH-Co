import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  Req,
  UseGuards,
  ValidationPipe,
  Get,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { requestTenant } from './tenant';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionGuard } from './session.guard';
import type { AuthenticatedRequest } from './session.guard';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(SessionGuard)
  async register(
    @Body(
      new ValidationPipe({
        expectedType: RegisterDto,
        transform: true,
        whitelist: true,
      }),
    )
    registerDto: RegisterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.register(registerDto, request.sessionUser);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(
      new ValidationPipe({
        expectedType: LoginDto,
        transform: true,
        whitelist: true,
      }),
    )
    loginDto: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tenant = requestTenant(request);
    if (process.env.TENANT_REQUIRE_SUBDOMAIN === 'true' && !tenant)
      throw new ForbiddenException(
        'Selecciona el área de acceso antes de iniciar sesión',
      );
    const result = await this.authService.login(
      loginDto,
      request.ip ?? 'desconocida',
      tenant,
    );
    response.cookie('iatech_session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });
    return result;
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const legacyToken = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : null;
    if (legacyToken)
      response.cookie('iatech_session', legacyToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 60 * 60 * 1000,
      });
    return { user: request.sessionUser };
  }

  @Post('logout')
  @UseGuards(SessionGuard)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('iatech_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { message: 'Sesión cerrada' };
  }
}
