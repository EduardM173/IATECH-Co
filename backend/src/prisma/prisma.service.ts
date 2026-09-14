import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// Importamos el cliente generado desde la carpeta database
import { PrismaClient } from 'database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
