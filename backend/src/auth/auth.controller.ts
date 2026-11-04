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
} from '@nestjs/common';
import type { Response } from 'express';
import { requestTenant } from './tenant';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CreateTransferDto, ExchangeTransferDto } from './dto/transfer.dto';
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

  @Post('transfer/create')
  @UseGuards(SessionGuard)
  async createTransfer(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: CreateTransferDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.createTransfer(
      request.sessionUser,
      request.sessionScope === 'central' ? request.sessionId : null,
      body.area,
    );
  }

  @Post('transfer/exchange')
  @HttpCode(HttpStatus.OK)
  async exchangeTransfer(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    body: ExchangeTransferDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.exchangeTransfer(
      body.code,
      requestTenant(request),
    );
    response.cookie('iatech_session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });
    return { user: result.user };
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
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.revokeSession(request.sessionId);
    response.clearCookie('iatech_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return { message: 'Sesión cerrada' };
  }
}
