// "Retry from here" and "Edit input and retry". Retrying a step makes its saved
// result and every later one stale, so they run again with fresh inputs. That
// is fine for steps without side effects. It is refused when this or a later
// side effect already happened: running it again with new data would book a
// second, different invoice (or rule 2 would quietly return the old one).

export type Plan = { order: string[]; effects: string[] };

export type RetryPlan = { ok: true; invalidate: string[] } | { ok: false; reason: string };

export function retryPlan(plan: Plan, done: Set<string>, from: string): RetryPlan {
  const i = plan.order.indexOf(from);
  if (i < 0) return { ok: false, reason: `Unknown step ${from}.` };
  const affected = plan.order.slice(i);
  const happened = affected.filter((k) => plan.effects.includes(k) && done.has(k));
  if (happened.length > 0)
    return { ok: false, reason: `${happened.join(', ')} already happened. Retrying from ${from} would do it again with new data. Fix it in the target system instead.` };
  return { ok: true, invalidate: affected };
}
