// Chaos test: many invoices, random faults, and a worker that dies at random
// moments (after a step's work is done, before its result is saved). A
// simulated operator approves, fixes and retries until nothing moves. Then we
// count what matters: double bookings, double messages, stuck runs, repeated
// model calls. Run twice: with the rules, and with a naive baseline that books
// without asking first.
//   npm run chaos -- [runs] [seed]
import { writeFileSync } from 'node:fs';
import { advance, type Engine } from '@/engine/advance';
import { MemoryRuns } from '@/engine/memory';
import { MemoryStore } from '@/core/memory-store';
import { decide, resolveUnknown } from '@/core/human';
import { happenedSteps } from '@/workflow/plan';
import { retryPlan } from '@/core/retry';
import type { StepResult } from '@/core/step';
import { invoiceWorkflow, PLAN, type InvoiceInput } from '@/workflow/invoice';
import { MemoryErp } from '@/workflow/erp';
import { PURCHASE_ORDERS, SCENARIOS, type Faults } from '../fixtures/invoices';
import { parseInvoice } from '../fixtures/parse';

const N = Number(process.argv[2] ?? 300);
const SEEDS = process.argv[3] ? [Number(process.argv[3])] : [1, 2, 3, 4, 5];
let SEED = SEEDS[0]!;

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

class Crash extends Error {}

async function trial(naive: boolean) {
  const random = rng(SEED);
  const store = new MemoryStore();
  const runs = new MemoryRuns(store);
  const erp = new MemoryErp(PURCHASE_ORDERS);
  let modelCalls = 0, crashes = 0, retriesScheduled = 0;
  const crashesAt: Record<string, number> = {};
  const dying = { on: false, inWorker: false };

  // A worker can die after a step's work finished but before the result is saved.
  const crashPlan = new Map<string, string>();
  const finish = store.finish.bind(store);
  store.finish = async (runId: string, key: string, attempt: number, r: StepResult) => {
    if (dying.on) throw new Crash();
    if (dying.inWorker && r.status === 'done' && crashPlan.get(runId) === key && attempt === 1) { crashPlan.delete(runId); dying.on = true; crashes++; crashesAt[key] = (crashesAt[key] ?? 0) + 1; throw new Crash(); }
    return finish(runId, key, attempt, r);
  };
  const update = runs.update.bind(runs);
  runs.update = async (...a: Parameters<typeof runs.update>) => { if (dying.on) throw new Crash(); return update(...a); };

  let now = 0;
  const queue: { runId: string; at: number }[] = [];
  const e: Engine<InvoiceInput> = {
    store, runs,
    workflow: (id, input) => invoiceWorkflow(id, input, { store, erp, naiveEffects: naive, extract: async (t) => { modelCalls++; return parseInvoice(t); } }),
    schedule: async (runId, delay) => { retriesScheduled++; queue.push({ runId, at: now + delay }); },
  };

  const ids: string[] = [];
  for (let i = 0; i < N; i++) {
    const s = SCENARIOS[Math.floor(random() * SCENARIOS.length)]!;
    const faults: Faults = {
      rateLimit: random() < 0.25 ? 1 + Math.floor(random() * 3) : 0,
      erpTimeoutAfterCommit: random() < 0.25,
      notifyFailsOnce: random() < 0.15,
      mailTimeoutAfterSend: random() < 0.2,
    };
    const id = `run-${i}`;
    ids.push(id);
    runs.add(id, { text: s.text, faults });
    if (random() < 0.3) crashPlan.set(id, PLAN.order[Math.floor(random() * PLAN.order.length)]!);
    queue.push({ runId: id, at: random() * 1000 });
  }

  const drain = async () => {
    while (queue.length) {
      queue.sort((a, b) => a.at - b.at);
      const job = queue.shift()!;
      now = Math.max(now, job.at);
      dying.inWorker = true;
      try {
        await advance(e, job.runId);
      } catch (err) {
        if (!(err instanceof Crash)) throw err;
        dying.on = false;                       // a new worker picks up the stalled job
        queue.push({ runId: job.runId, at: now + 30_000 });
      } finally {
        dying.inWorker = false;
      }
    }
  };

  // The operator: approve or reject waiting runs, fix wrong PO numbers, retry failed messages.
  let operatorActions = 0, unknownOutcomes = 0, checkedSent = 0, checkedNotSent = 0;
  for (let round = 0; round < 10; round++) {
    await drain();
    let acted = false;
    for (const id of ids) {
      const run = runs.runs.get(id)!;
      if (run.status === 'waiting') {
        const reject = (run.input as InvoiceInput).text.includes('KFS-11873-B');
        await decide(store, id, 'approve', reject ? { approved: false, by: 'operator', note: 'Duplicate of KFS-11873' } : { approved: true, by: 'operator', note: '' });
        queue.push({ runId: id, at: now }); acted = true; operatorActions++;
      } else if (run.status === 'failed' && run.currentStep && (await store.lastValid(id, run.currentStep))?.errorKind === 'unknown') {
        // The person checks the mailbox: did the message for this reference go out?
        const happened = erp.messages.some((m) => m.externalRef === `${id}:${run.currentStep}`);
        await resolveUnknown(store, id, run.currentStep, { happened, by: 'operator', note: '' });
        unknownOutcomes++; if (happened) checkedSent++; else checkedNotSent++;
        run.status = 'running';
        queue.push({ runId: id, at: now }); acted = true; operatorActions++;
      } else if (run.status === 'failed' && (run.currentStep === 'match_po' || run.currentStep === 'notify')) {
        const latest: Record<string, { status: string; errorKind?: string | null }> = {};
        for (const r of store.rows) if (r.runId === id && !r.invalidated) latest[r.key] = r;
        const done = happenedSteps(latest);
        const plan = retryPlan(PLAN, done, run.currentStep);
        if (!plan.ok) continue;
        for (const r of store.rows) if (r.runId === id && plan.invalidate.includes(r.key)) r.invalidated = true;
        if (run.currentStep === 'match_po') {
          const input = run.input as InvoiceInput;
          run.input = { ...input, overrides: { match_po: { poNumber: 'PO-4473' } } };
        }
        run.status = 'running';
        queue.push({ runId: id, at: now }); acted = true; operatorActions++;
      }
    }
    if (!acted) break;
  }

  const count = <T,>(xs: T[], key: (x: T) => string) => { const m = new Map<string, number>(); for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1); return m; };
  const dupBookings = [...count(erp.bookings, (b) => b.externalRef).values()].filter((n) => n > 1).reduce((s, n) => s + n - 1, 0);
  const dupMessages = [...count(erp.messages, (m) => m.externalRef).values()].filter((n) => n > 1).reduce((s, n) => s + n - 1, 0);
  const states = count([...runs.runs.values()], (r) => r.status === 'done' ? `done (${(r.outcome as { result: string }).result})` : `${r.status}${r.currentStep ? ` at ${r.currentStep}` : ''}`);
  return { naive, runs: N, crashes, crashesAt, unknownOutcomes, checkedSent, checkedNotSent, retriesScheduled, operatorActions, modelCalls, bookings: erp.bookings.length, dupBookings, messages: erp.messages.length, dupMessages, states: Object.fromEntries([...states].sort()) };
}

type Trial = Awaited<ReturnType<typeof trial>>;
const line = (r: Trial) => [
  `- worker crashes injected: ${r.crashes} (${Object.entries(r.crashesAt).map(([k, v]) => `${k} ${v}`).join(', ')}), automatic retries: ${r.retriesScheduled}, operator actions: ${r.operatorActions}`,
  `- end states: ${Object.entries(r.states).map(([k, v]) => `${k}: ${v}`).join(', ')}`,
  `- bookings: ${r.bookings}, duplicate bookings: **${r.dupBookings}**`,
  `- messages: ${r.messages}, duplicate messages: **${r.dupMessages}**`,
  `- model calls: ${r.modelCalls} for ${r.runs} runs (${r.modelCalls - r.runs} repeated; crashes during extract: ${r.crashesAt['extract'] ?? 0})`,
  `- unknown outcomes stopped for a person: ${r.unknownOutcomes} (had gone out: ${r.checkedSent}, had not: ${r.checkedNotSent})`,
].join('\n');
const sections: string[] = [];
const table = ['| Seed | Crashes | Booked | Rejected | Stopped (bad totals) | Unknown outcomes checked by a person | Duplicate bookings | Duplicate messages | Baseline duplicate bookings | Baseline duplicate messages |', '|---|---|---|---|---|---|---|---|---|---|'];
for (const seed of SEEDS) {
  SEED = seed;
  const withRules = await trial(false);
  const baseline = await trial(true);
  const st = withRules.states as Record<string, number>;
  table.push(`| ${seed} | ${withRules.crashes} | ${st['done (booked)'] ?? 0} | ${st['done (rejected)'] ?? 0} | ${st['failed at check_totals'] ?? 0} | ${withRules.unknownOutcomes} | **${withRules.dupBookings}** | **${withRules.dupMessages}** | ${baseline.dupBookings} | ${baseline.dupMessages} |`);
  sections.push(`## Seed ${seed}\n\n### With the rules\n${line(withRules)}\n\n### Naive baseline (books and messages without asking first)\n${line(baseline)}\n`);
}
const report = `# Chaos test\n\n${N} runs per seed. Faults: model rate limits (25% of runs), ERP timeout after the booking was saved (25%), requester mailbox missing once (15%), mail server timeout after the message was sent (20%), a worker crash right after a step's work finished and before its result was saved (30%). A simulated operator approves, rejects, fixes the purchase order and retries until nothing moves.\n\n${table.join('\n')}\n\n${sections.join('\n')}`;
writeFileSync('eval/chaos-results.md', report);
console.log(table.join('\n'));
