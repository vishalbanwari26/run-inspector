// The run worker: each job moves one run forward under a per-run lock.
import { Worker } from 'bullmq';
import { createPrismaClient } from '@/lib/prisma';
import { QUEUE, redisConnection, runQueue, type RunJob } from '@/lib/queue';
import { groqExtract } from '@/workflow/extract';
import { advanceLocked, engine } from '@/services/runs';
import { parseInvoice } from '../fixtures/parse';

const db = createPrismaClient();
const queue = runQueue();
// EXTRACT_FAKE=1 skips the model (local UI work only); the demo uses Groq.
const extract = process.env['EXTRACT_FAKE'] === '1' ? async (t: string) => parseInvoice(t) : groqExtract;
const e = engine(db, queue, extract);
const concurrency = Number(process.env['RUN_CONCURRENCY'] ?? 2);

const worker = new Worker<RunJob>(QUEUE, async (job) => {
  const status = await advanceLocked(db, e, job.data.runId);
  // Another worker holds this run: try again shortly instead of dropping the job.
  if (status === 'locked') await queue.add('advance', job.data, { delay: 1000 });
  console.log(`${job.data.runId}: ${status}`);
}, { connection: redisConnection(), concurrency });
worker.on('failed', (job, err) => console.error(`job ${job?.id} crashed: ${err.message}`));
console.log(`worker up, concurrency ${concurrency}`);
