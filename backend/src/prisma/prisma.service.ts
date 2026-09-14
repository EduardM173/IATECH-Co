import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { prisma, PrismaClient } from 'database';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient = prisma;

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
