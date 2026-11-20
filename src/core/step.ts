// Runs a workflow step at most once per run: a step that already succeeded
// returns its saved output instead of running again. Every attempt is stored,
// so the inspector can show the full history.
import { classify, type ErrorKind } from './errors';

export type StepStatus = 'running' | 'done' | 'failed' | 'waiting';
export type StepRecord = { key: string; attempt: number; status: StepStatus; output?: unknown; error?: string; errorKind?: ErrorKind };
export type StepResult = { status: StepStatus; output?: unknown; error?: string; errorKind?: ErrorKind };

export interface StepStore {
  /** Latest attempt of this step that a "retry from here" has not made stale. */
  lastValid(runId: string, key: string): Promise<StepRecord | null>;
  /** Every attempt of this step that a retry has not set aside, oldest first. */
  attempts(runId: string, key: string): Promise<StepRecord[]>;
  /** Sets aside every attempt of these steps, so they run again from scratch. */
  invalidate(runId: string, keys: string[]): Promise<void>;
  /** Records a new attempt as running and returns its number (1, 2, 3...). */
  start(runId: string, key: string, input: unknown): Promise<number>;
  finish(runId: string, key: string, attempt: number, result: StepResult): Promise<void>;
}

export async function runStep<T>(store: StepStore, runId: string, key: string, input: unknown, fn: () => Promise<T>): Promise<T> {
  const prev = await store.lastValid(runId, key);
  if (prev?.status === 'done') return prev.output as T;
  const attempt = await store.start(runId, key, input);
  try {
    const output = await fn();
    await store.finish(runId, key, attempt, { status: 'done', output });
    return output;
  } catch (e) {
    await store.finish(runId, key, attempt, { status: 'failed', error: (e as Error).message, errorKind: classify(e) });
    throw e;
  }
}
