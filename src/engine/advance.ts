// Moves one run forward as far as it can go: to done, to a person, to a
// scheduled retry, or to a stop that needs a person. Storage and scheduling
// are passed in, so the app (Postgres + BullMQ) and the chaos test (memory +
// virtual time) run the same code.
import { classify, nextAction } from '@/core/errors';
import { WaitingForHuman } from '@/core/human';
import type { StepStore } from '@/core/step';

export type RunStatus = 'running' | 'waiting' | 'failed' | 'done';
export type RunState = { id: string; status: RunStatus; input: unknown; currentStep: string | null };
export type RunPatch = { status: RunStatus; currentStep?: string | null; error?: string | null; outcome?: unknown };

export interface RunRepo {
  get(id: string): Promise<RunState>;
  update(id: string, patch: RunPatch): Promise<void>;
  /** Latest attempt that failed, to know which step and attempt number. */
  lastFailure(id: string): Promise<{ key: string; attempt: number } | null>;
}

export type Engine<I> = {
  store: StepStore;
  runs: RunRepo;
  workflow: (runId: string, input: I) => Promise<unknown>;
  schedule: (runId: string, delayMs: number) => Promise<void>;
};

export async function advance<I>(e: Engine<I>, runId: string): Promise<RunStatus> {
  const run = await e.runs.get(runId);
  if (run.status === 'done') return 'done';
  await e.runs.update(runId, { status: 'running', error: null });
  try {
    const outcome = await e.workflow(runId, run.input as I);
    await e.runs.update(runId, { status: 'done', currentStep: null, outcome });
    return 'done';
  } catch (err) {
    if (err instanceof WaitingForHuman) {
      await e.runs.update(runId, { status: 'waiting', currentStep: err.key });
      return 'waiting';
    }
    const failed = await e.runs.lastFailure(runId);
    const message = (err as Error).message;
    const act = nextAction(classify(err), failed?.attempt ?? 1);
    if ('retryInMs' in act) {
      await e.runs.update(runId, { status: 'running', currentStep: failed?.key ?? null, error: message });
      await e.schedule(runId, act.retryInMs);
      return 'running';
    }
    await e.runs.update(runId, { status: 'failed', currentStep: failed?.key ?? null, error: message });
    return 'failed';
  }
}
