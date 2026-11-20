// A step that needs a person. The first time it runs it records 'waiting' and
// the run stops without holding a worker. A decision completes the step later,
// and the run is picked up again from the top: finished steps return their
// saved output (rule 1), so it continues right after the decision.
import type { StepStore } from './step';

export type Decision = { approved: boolean; by: string; note: string };

export class WaitingForHuman extends Error {
  constructor(readonly key: string, readonly ask: unknown) { super(`waiting for a person at ${key}`); }
}

export async function humanStep(store: StepStore, runId: string, key: string, ask: unknown): Promise<Decision> {
  const prev = await store.lastValid(runId, key);
  if (prev?.status === 'done') return prev.output as Decision;
  if (prev?.status !== 'waiting') {
    const attempt = await store.start(runId, key, ask);
    await store.finish(runId, key, attempt, { status: 'waiting' });
  }
  throw new WaitingForHuman(key, ask);
}

export const MIN_REJECT_NOTE = 10;

export async function decide(store: StepStore, runId: string, key: string, d: Decision) {
  const prev = await store.lastValid(runId, key);
  if (prev?.status !== 'waiting') return { ok: false as const, reason: 'This step is not waiting for a decision.' };
  if (!d.approved && d.note.trim().length < MIN_REJECT_NOTE)
    return { ok: false as const, reason: `Rejecting needs a reason of at least ${MIN_REJECT_NOTE} characters.` };
  await store.finish(runId, key, prev.attempt, { status: 'done', output: d });
  return { ok: true as const };
}

// When a side effect's outcome is unknown, a person checks the target system
// (the mailbox, the payment provider) and says whether it happened.
// Yes: the step is recorded as done, and the run continues without doing it again.
// No: the uncertain attempts are set aside, so the next attempt does it normally.
export type OutcomeCheck = { happened: boolean; by: string; note: string };

export async function resolveUnknown(store: StepStore, runId: string, key: string, c: OutcomeCheck) {
  const last = await store.lastValid(runId, key);
  if (last?.errorKind !== 'unknown') return { ok: false as const, reason: 'This step has no unknown outcome to resolve.' };
  if (c.happened) {
    const attempt = await store.start(runId, key, { check: c });
    await store.finish(runId, key, attempt, {
      status: 'done',
      output: { result: { id: `checked by ${c.by}` }, reused: true, checkedBy: c.by, note: c.note },
    });
    return { ok: true as const, next: 'continue' as const };
  }
  await store.invalidate(runId, [key]);
  return { ok: true as const, next: 'retry' as const };
}
