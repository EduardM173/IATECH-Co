import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionGuard } from './session.guard';
import { SeguridadService } from '../seguridad/seguridad.service';
import { SeguridadController } from '../seguridad/seguridad.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController, SeguridadController],
  providers: [AuthService, SessionGuard, SeguridadService],
  exports: [SessionGuard],
})
export class AuthModule {}
