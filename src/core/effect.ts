// Side effects (booking an invoice, sending a message) must happen once per
// run, even when a call times out or the worker crashes mid-step. Each effect
// carries a reference built from the run and the step. Before acting, the
// step asks the target system whether that reference is already there.

export type EffectTarget<T> = {
  /** Find an earlier result of this exact effect by its reference. */
  find(ref: string): Promise<T | null>;
  /** Perform the effect, tagged with the reference. */
  perform(ref: string): Promise<T>;
};

/** Same run + same step = same reference, on every attempt. */
export function effectRef(runId: string, stepKey: string): string {
  return `${runId}:${stepKey}`;
}

export async function once<T>(target: EffectTarget<T>, ref: string): Promise<{ result: T; reused: boolean }> {
  const earlier = await target.find(ref);
  if (earlier) return { result: earlier, reused: true };
  return { result: await target.perform(ref), reused: false };
}
