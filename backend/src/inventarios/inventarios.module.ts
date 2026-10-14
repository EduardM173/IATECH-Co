import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InventariosService } from './inventarios.service';
import {
  InventariosController,
  ReportesController,
  BIController,
} from './inventarios.controller';
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [InventariosController, ReportesController, BIController],
  providers: [InventariosService],
})
export class InventariosModule {}
