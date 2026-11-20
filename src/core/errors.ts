// Which failures fix themselves and which need a person. Unknown errors count
// as permanent: a run should stop and ask, never loop on something new.

export type ErrorKind = 'transient' | 'permanent';

export class StepError extends Error {
  constructor(message: string, readonly kind: ErrorKind) { super(message); }
}
export const transient = (message: string) => new StepError(message, 'transient');
export const permanent = (message: string) => new StepError(message, 'permanent');

export function classify(e: unknown): ErrorKind {
  if (e instanceof StepError) return e.kind;
  const m = String((e as Error)?.message ?? e).toLowerCase();
  if (/\b(429|rate limit|timeout|timed out|econnreset|502|503)\b/.test(m)) return 'transient';
  return 'permanent';
}

export const RETRY = { maxAttempts: 4, baseMs: 2000 };

/** What to do after attempt number `attempt` failed. */
export function nextAction(kind: ErrorKind, attempt: number): { retryInMs: number } | { stop: true } {
  if (kind === 'permanent' || attempt >= RETRY.maxAttempts) return { stop: true };
  return { retryInMs: RETRY.baseMs * 2 ** (attempt - 1) };
}
