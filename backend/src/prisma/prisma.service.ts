import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prisma 7 talks to Postgres through the pg driver; DATABASE_URL is set by then (ConfigModule)
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      // log: [{ emit: 'stdout', level: 'query' }],
    });
  }
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
