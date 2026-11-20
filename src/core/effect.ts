// Side effects (booking an invoice, sending a message) must happen once per
// run, even when a call times out or the worker crashes mid-step. Each effect
// carries a reference built from the run and the step, the same on every
// attempt. What makes a retry safe depends on the target system:
// - it can be searched by the reference: look first, write only if missing;
// - it drops repeats with the same key (idempotency keys): send the key again;
// - neither: after a timeout or a crash the outcome is unknown, so the step
//   stops for a person instead of trying again.
import { classify, unknown } from './errors';

export type EffectTarget<T> = {
  /** Look up an earlier result by reference, when the system can be searched (ERP). */
  find?: (ref: string) => Promise<T | null>;
  /** Do the effect, tagged with the reference. */
  perform: (ref: string) => Promise<T>;
  /** True when the system itself drops repeats that carry the same key. */
  idempotent?: boolean;
};

/** Same run + same step = same reference, on every attempt. */
export function effectRef(runId: string, stepKey: string): string {
  return `${runId}:${stepKey}`;
}

/** triedBefore: an earlier attempt of this step may have done it (crashed mid-step, or outcome unknown). */
export async function once<T>(target: EffectTarget<T>, ref: string, triedBefore: boolean): Promise<{ result: T; reused: boolean }> {
  if (target.find) {
    const earlier = await target.find(ref);
    if (earlier) return { result: earlier, reused: true };
  } else if (triedBefore && !target.idempotent) {
    throw unknown('An earlier attempt may have gone through, and this system cannot be checked.');
  }
  try {
    return { result: await target.perform(ref), reused: false };
  } catch (e) {
    if (classify(e) === 'transient' && !target.find && !target.idempotent)
      throw unknown(`${(e as Error).message}. It may have gone through, and this system cannot be checked.`);
    throw e;
  }
}
