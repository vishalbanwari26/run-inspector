import { describe, expect, it } from 'vitest';
import { advance, type Engine } from '@/engine/advance';
import { MemoryRuns } from '@/engine/memory';
import { MemoryStore } from '@/core/memory-store';
import { decide } from '@/core/human';
import { invoiceWorkflow, type InvoiceInput } from '@/workflow/invoice';
import { MemoryErp } from '@/workflow/erp';
import { PURCHASE_ORDERS } from '../fixtures/invoices';

const fields = (o: Partial<Record<string, unknown>> = {}) => ({
  vendor: 'Halden Catering', invoiceNumber: 'HC-1', poNumber: 'PO-4474', requester: 'a@b.example', currency: 'EUR',
  lines: [{ description: 'Lunch', amount: 525 }, { description: 'Coffee', amount: 120 }], total: 645, ...o,
});

function setup(extracted: unknown = fields()) {
  const store = new MemoryStore();
  const runs = new MemoryRuns(store);
  const erp = new MemoryErp(PURCHASE_ORDERS);
  const scheduled: { runId: string; delay: number }[] = [];
  const e: Engine<InvoiceInput> = {
    store, runs,
    workflow: (id, input) => invoiceWorkflow(id, input, { store, erp, extract: async () => extracted }),
    schedule: async (runId, delay) => { scheduled.push({ runId, delay }); },
  };
  return { store, runs, erp, scheduled, e };
}

describe('invoice workflow through the engine', () => {
  it('books a clean invoice and notifies the requester', async () => {
    const s = setup();
    s.runs.add('r', { text: 'x' });
    expect(await advance(s.e, 'r')).toBe('done');
    expect(s.erp.bookings).toHaveLength(1);
    expect(s.erp.messages).toHaveLength(1);
  });

  it('waits for a person over the limit, then books after approval', async () => {
    const s = setup(fields({ poNumber: 'PO-4472', vendor: 'Kessler Facility Services', lines: [{ description: 'HVAC', amount: 7920 }], total: 7920 }));
    s.runs.add('r', { text: 'x' });
    expect(await advance(s.e, 'r')).toBe('waiting');
    await decide(s.store, 'r', 'approve', { approved: true, by: 'Mara', note: '' });
    expect(await advance(s.e, 'r')).toBe('done');
    expect(s.erp.bookings).toHaveLength(1);
  });

  it('schedules a retry for a rate limit and finishes later', async () => {
    const s = setup();
    s.runs.add('r', { text: 'x', faults: { rateLimit: 1 } });
    expect(await advance(s.e, 'r')).toBe('running');
    expect(s.scheduled).toEqual([{ runId: 'r', delay: 2000 }]);
    expect(await advance(s.e, 'r')).toBe('done');
  });

  it('books once when the ERP times out after saving', async () => {
    const s = setup();
    s.runs.add('r', { text: 'x', faults: { erpTimeoutAfterCommit: true } });
    expect(await advance(s.e, 'r')).toBe('running');
    expect(await advance(s.e, 'r')).toBe('done');
    expect(s.erp.bookings).toHaveLength(1);
  });

  it('stops for a person when the purchase order does not exist', async () => {
    const s = setup(fields({ poNumber: 'PO-9999' }));
    s.runs.add('r', { text: 'x' });
    expect(await advance(s.e, 'r')).toBe('failed');
    expect((await s.runs.get('r')).currentStep).toBe('match_po');
  });

  it('stops when the lines do not add up', async () => {
    const s = setup(fields({ total: 700 }));
    s.runs.add('r', { text: 'x' });
    expect(await advance(s.e, 'r')).toBe('failed');
    expect(s.erp.bookings).toHaveLength(0);
  });
});
