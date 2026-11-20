// Run actions for the worker and the API: start, advance (under a per-run
// lock), decide, and retry from a step. The rules live in src/core.
import type { Prisma, PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import { advance, type Engine } from '@/engine/advance';
import { decide, resolveUnknown, type Decision, type OutcomeCheck } from '@/core/human';
import { retryPlan } from '@/core/retry';
import type { RunJob } from '@/lib/queue';
import { invoiceWorkflow, PLAN, type InvoiceInput } from '@/workflow/invoice';
import { happenedSteps } from '@/workflow/plan';
import { PrismaErp } from '@/workflow/erp';
import { PrismaRunRepo, PrismaStepStore } from './prisma-store';

export function engine(db: PrismaClient, queue: Queue<RunJob>, extract: (t: string) => Promise<unknown>): Engine<InvoiceInput> {
  const store = new PrismaStepStore(db);
  const erp = new PrismaErp(db);
  return {
    store,
    runs: new PrismaRunRepo(db),
    workflow: (runId, input) => invoiceWorkflow(runId, input, { store, erp, extract }),
    schedule: async (runId, delay) => { await queue.add('advance', { runId }, { delay }); },
  };
}

export async function startRun(db: PrismaClient, queue: Queue<RunJob>, title: string, input: InvoiceInput) {
  const run = await db.run.create({ data: { workflow: 'invoice-to-erp', title, input: input as Prisma.InputJsonValue } });
  await queue.add('advance', { runId: run.id });
  return run;
}

// One worker per run at a time: a Postgres advisory lock keyed on the run id.
export async function advanceLocked(db: PrismaClient, e: Engine<InvoiceInput>, runId: string) {
  return db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ ok: boolean }[]>`select pg_try_advisory_xact_lock(hashtext(${runId})) as ok`;
    if (!row?.ok) return 'locked';
    return advance(e, runId);
  }, { timeout: 120_000 });
}

export async function decideRun(db: PrismaClient, queue: Queue<RunJob>, runId: string, d: Decision) {
  const run = await db.run.findUniqueOrThrow({ where: { id: runId } });
  if (run.status !== 'waiting' || !run.currentStep) return { ok: false as const, reason: 'This run is not waiting for a decision.' };
  const r = await decide(new PrismaStepStore(db), runId, run.currentStep, d);
  if (r.ok) await queue.add('advance', { runId });
  return r;
}

export async function retryRun(db: PrismaClient, queue: Queue<RunJob>, runId: string, from: string, edit?: { poNumber: string }) {
  const run = await db.run.findUniqueOrThrow({ where: { id: runId } });
  if (run.status === 'running') return { ok: false as const, reason: 'The run is still running.' };
  const rows = await db.stepRun.findMany({ where: { runId, invalidated: false }, orderBy: { attempt: 'asc' } });
  const latest: Record<string, { status: string; errorKind: string | null }> = {};
  for (const r of rows) latest[r.key] = { status: r.status, errorKind: r.errorKind };
  const done = happenedSteps(latest);
  const plan = retryPlan(PLAN, done, from);
  if (!plan.ok) return plan;
  const input = run.input as InvoiceInput;
  const next: InvoiceInput = edit && from === 'match_po' ? { ...input, overrides: { ...input.overrides, match_po: edit } } : input;
  await db.$transaction([
    db.stepRun.updateMany({ where: { runId, key: { in: plan.invalidate } }, data: { invalidated: true } }),
    db.run.update({ where: { id: runId }, data: { status: 'running', error: null, input: next as Prisma.InputJsonValue } }),
  ]);
  await queue.add('advance', { runId });
  return { ok: true as const };
}

export async function resolveRun(db: PrismaClient, queue: Queue<RunJob>, runId: string, c: OutcomeCheck) {
  const run = await db.run.findUniqueOrThrow({ where: { id: runId } });
  if (run.status !== 'failed' || !run.currentStep) return { ok: false as const, reason: 'This run is not waiting for a check.' };
  const r = await resolveUnknown(new PrismaStepStore(db), runId, run.currentStep, c);
  if (!r.ok) return r;
  await db.run.update({ where: { id: runId }, data: { status: 'running', error: null } });
  await queue.add('advance', { runId });
  return { ok: true as const };
}
