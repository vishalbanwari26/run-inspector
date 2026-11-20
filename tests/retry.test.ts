import { describe, expect, it } from 'vitest';
import { retryPlan, type Plan } from '@/core/retry';

const plan: Plan = {
  order: ['extract', 'check_totals', 'match_po', 'approve', 'post_invoice', 'notify'],
  effects: ['post_invoice', 'notify'],
};
const done = (...keys: string[]) => new Set(keys);

describe('retryPlan', () => {
  it('reruns the step and everything after it, approval included', () => {
    expect(retryPlan(plan, done('extract', 'check_totals'), 'match_po'))
      .toEqual({ ok: true, invalidate: ['match_po', 'approve', 'post_invoice', 'notify'] });
  });
  it('refuses when a later side effect already happened', () => {
    const r = retryPlan(plan, done('extract', 'check_totals', 'match_po', 'approve', 'post_invoice'), 'match_po');
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.reason).toContain('post_invoice already happened');
  });
  it('allows retrying a failed side effect that never happened', () => {
    expect(retryPlan(plan, done('extract', 'check_totals', 'match_po', 'approve', 'post_invoice'), 'notify'))
      .toEqual({ ok: true, invalidate: ['notify'] });
  });
  it('refuses retrying a side effect that already happened', () => {
    expect(retryPlan(plan, done('post_invoice'), 'post_invoice').ok).toBe(false);
  });
  it('rejects an unknown step', () => {
    expect(retryPlan(plan, done(), 'pay')).toEqual({ ok: false, reason: 'Unknown step pay.' });
  });
});
