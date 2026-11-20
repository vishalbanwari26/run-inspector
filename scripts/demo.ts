// Seeds the fake ERP and starts the demo runs through the real worker (start
// it first: npm run worker). Then plays the person: approves, rejects and
// fixes a purchase order where the scenario says so, and leaves the rest
// waiting or stopped so the inspector has something to show.
import { createPrismaClient } from '@/lib/prisma';
import { runQueue } from '@/lib/queue';
import { decideRun, retryRun, startRun } from '@/services/runs';
import { PURCHASE_ORDERS, SCENARIOS } from '../fixtures/invoices';

const db = createPrismaClient();
const queue = runQueue();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

await db.$transaction([db.stepRun.deleteMany(), db.run.deleteMany(), db.erpInvoice.deleteMany(), db.erpMessage.deleteMany(), db.purchaseOrder.deleteMany()]);
await db.purchaseOrder.createMany({ data: PURCHASE_ORDERS });

const started: { id: string; then?: string }[] = [];
for (const s of SCENARIOS) {
  const run = await startRun(db, queue, s.title, { text: s.text, faults: s.faults });
  started.push({ id: run.id, then: s.then });
  await sleep(1500);
}

async function settle() {
  for (;;) {
    const busy = await db.run.count({ where: { status: 'running' } });
    if (busy === 0) return;
    await sleep(2000);
  }
}
await settle();

for (const r of started) {
  const run = await db.run.findUniqueOrThrow({ where: { id: r.id } });
  if (r.then === 'approve' && run.status === 'waiting') await decideRun(db, queue, r.id, { approved: true, by: 'Mara Lind', note: 'Matches the signed maintenance contract.' });
  if (r.then === 'reject' && run.status === 'waiting') await decideRun(db, queue, r.id, { approved: false, by: 'Mara Lind', note: 'Duplicate of KFS-11873, already in review.' });
  if (r.then === 'fix-po' && run.status === 'failed') await retryRun(db, queue, r.id, 'match_po', { poNumber: 'PO-4473' });
}
await sleep(1500);
await settle();

for (const r of await db.run.findMany({ orderBy: { createdAt: 'asc' } })) console.log(`${r.status.padEnd(8)} ${r.currentStep ?? ''}`.padEnd(24), r.title);
await queue.close();
await db.$disconnect();
process.exit(0);
