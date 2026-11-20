// The invoice workflow's step order and side effects, shared by the server and the browser.
import type { Plan } from '@/core/retry';

export const PLAN: Plan = {
  order: ['extract', 'check_totals', 'match_po', 'approve', 'post_invoice', 'notify'],
  effects: ['post_invoice', 'notify'],
};

/** Steps that happened or may have happened: done, or a side effect whose outcome is unknown. */
export function happenedSteps(latest: Record<string, { status: string; errorKind?: string | null } | undefined>): Set<string> {
  const out = new Set<string>();
  for (const [key, a] of Object.entries(latest)) {
    if (!a) continue;
    if (a.status === 'done' || (PLAN.effects.includes(key) && a.errorKind === 'unknown')) out.add(key);
  }
  return out;
}
