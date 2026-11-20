// Prisma 7 reads the connection URL from here for the CLI; the runtime client
// gets it through the pg driver adapter in src/lib/prisma.ts.
import { defineConfig } from 'prisma/config';
import { loadEnv } from './src/lib/env';

loadEnv();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { seed: 'tsx prisma/seed.ts' },
  datasource: { url: process.env['DATABASE_URL'] ?? '' },
});
