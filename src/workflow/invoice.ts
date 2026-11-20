// The sample workflow: an invoice goes from text to a booking in the ERP.
// It only wires the core rules together: runStep (rule 1), once (rule 2),
// typed errors (rule 3), humanStep (rule 4) and the retry plan (rule 5).
import { z } from 'zod';
import { runStep, type StepStore } from '@/core/step';
import { effectRef, once } from '@/core/effect';
import { permanent, transient } from '@/core/errors';
import { humanStep } from '@/core/human';
import type { Erp } from './erp';
import type { Faults } from '../../fixtures/invoices';

export { PLAN } from './plan';
export const APPROVAL_LIMIT = 5000;

export const Fields = z.object({
  vendor: z.string().min(1),
  invoiceNumber: z.string().min(1),
  poNumber: z.string().min(1),
  requester: z.string().min(3),
  currency: z.string().length(3),
  lines: z.array(z.object({ description: z.string(), amount: z.number() })).min(1),
  total: z.number(),
});
export type Fields = z.infer<typeof Fields>;

export type InvoiceInput = { text: string; faults?: Faults; overrides?: { match_po?: { poNumber: string } } };
export type Outcome =
  | { result: 'booked'; bookingId: string; messageId: string }
  | { result: 'rejected'; by: string; note: string };
export type WorkflowDeps = {
  store: StepStore;
  erp: Erp;
  extract: (text: string) => Promise<unknown>;
  /** Chaos-test baseline only: book without the once() check. */
  naiveEffects?: boolean;
};

const cents = (n: number) => Math.round(n * 100);
const attemptOf = async (d: WorkflowDeps, runId: string, key: string) => (await d.store.lastValid(runId, key))?.attempt ?? 1;

export async function invoiceWorkflow(runId: string, input: InvoiceInput, d: WorkflowDeps): Promise<Outcome> {
  const faults = input.faults ?? {};

  const fields = await runStep(d.store, runId, 'extract', { text: input.text }, async () => {
    if ((faults.rateLimit ?? 0) >= (await attemptOf(d, runId, 'extract'))) throw transient('model call failed: 429 rate limit (injected)');
    const parsed = Fields.safeParse(await d.extract(input.text));
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw permanent(`Model output does not match the invoice schema: ${i?.path.join('.')} ${i?.message}`);
    }
    return parsed.data;
  });

  await runStep(d.store, runId, 'check_totals', { lines: fields.lines, total: fields.total }, async () => {
    const sum = fields.lines.reduce((s, l) => s + cents(l.amount), 0);
    if (sum !== cents(fields.total)) throw permanent(`Lines add up to ${(sum / 100).toFixed(2)}, the invoice says ${fields.total.toFixed(2)}.`);
    return { sum: sum / 100 };
  });

  const poNumber = input.overrides?.match_po?.poNumber ?? fields.poNumber;
  const match = await runStep(d.store, runId, 'match_po', { poNumber }, async () => {
    const po = await d.erp.findPO(poNumber);
    if (!po) throw permanent(`Purchase order ${poNumber} not found in the ERP.`);
    const sameVendor = po.vendor === fields.vendor;
    const sameAmount = cents(po.amount) === cents(fields.total);
    return { po, sameVendor, sameAmount };
  });

  const reasons = [
    fields.total > APPROVAL_LIMIT && `total over ${APPROVAL_LIMIT.toLocaleString('en')} ${fields.currency}`,
    !match.sameVendor && 'vendor differs from the purchase order',
    !match.sameAmount && 'amount differs from the purchase order',
  ].filter(Boolean) as string[];
  if (reasons.length > 0) {
    const decision = await humanStep(d.store, runId, 'approve', {
      reasons, vendor: fields.vendor, invoiceNumber: fields.invoiceNumber, total: fields.total, currency: fields.currency, poNumber,
    });
    if (!decision.approved) return { result: 'rejected', by: decision.by, note: decision.note };
  } else {
    await runStep(d.store, runId, 'approve', {}, async () => ({ auto: true, reason: 'Under the limit and matches the purchase order.' }));
  }

  const bookingData = { vendor: fields.vendor, invoiceNumber: fields.invoiceNumber, amount: fields.total, currency: fields.currency, poNumber };
  const booking = await runStep(d.store, runId, 'post_invoice', bookingData, async () => {
    const ref = effectRef(runId, 'post_invoice');
    const attempt = await attemptOf(d, runId, 'post_invoice');
    const target = {
      find: (r: string) => d.erp.findBooking(r),
      perform: async (r: string) => {
        const b = await d.erp.book(r, bookingData);
        if (faults.erpTimeoutAfterCommit && attempt === 1) throw transient('ERP timeout after 30 s (injected; the booking was saved)');
        return b;
      },
    };
    return d.naiveEffects ? { result: await target.perform(ref), reused: false } : once(target, ref);
  });

  const text = `Invoice ${fields.invoiceNumber} from ${fields.vendor} (${fields.total.toFixed(2)} ${fields.currency}) is booked as ${booking.result.id}.`;
  const message = await runStep(d.store, runId, 'notify', { to: fields.requester, text }, async () => {
    const ref = effectRef(runId, 'notify');
    if (faults.notifyFailsOnce && (await attemptOf(d, runId, 'notify')) === 1) throw permanent(`Mailbox ${fields.requester} not found.`);
    const target = { find: (r: string) => d.erp.findMessage(r), perform: (r: string) => d.erp.send(r, fields.requester, text) };
    return d.naiveEffects ? { result: await target.perform(ref), reused: false } : once(target, ref);
  });

  return { result: 'booked', bookingId: booking.result.id, messageId: message.result.id };
}
