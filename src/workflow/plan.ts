// The invoice workflow's step order and side effects, shared by the server and the browser.
import type { Plan } from '@/core/retry';

export const PLAN: Plan = {
  order: ['extract', 'check_totals', 'match_po', 'approve', 'post_invoice', 'notify'],
  effects: ['post_invoice', 'notify'],
};
