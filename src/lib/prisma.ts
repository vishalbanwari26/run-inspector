import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { loadEnv } from './env';

export { loadEnv };


export function createPrismaClient(): PrismaClient {
  loadEnv();
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
