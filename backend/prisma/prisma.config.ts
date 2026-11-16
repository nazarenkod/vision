import { existsSync } from 'fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env by itself: a checkout keeps DATABASE_URL there, containers pass it in
if (existsSync('.env') && !process.env.DATABASE_URL) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'schema.prisma',
  migrations: { path: 'migrations', seed: 'ts-node seed.ts' },
  // read directly, not with env(): `prisma generate` runs at install without a database
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
