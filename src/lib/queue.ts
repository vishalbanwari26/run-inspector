// The run queue: one BullMQ job moves one run forward.
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { loadEnv } from './env';

export const QUEUE = 'runs';
export type RunJob = { runId: string };

export function redisConnection(): Redis {
  loadEnv();
  return new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6381', { maxRetriesPerRequest: null });
}

export function runQueue(): Queue<RunJob> {
  return new Queue<RunJob>(QUEUE, { connection: redisConnection() });
}
