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
