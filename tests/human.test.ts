import { describe, expect, it, vi } from 'vitest';
import { decide, humanStep, WaitingForHuman } from '@/core/human';
import { runStep } from '@/core/step';
import { MemoryStore } from '@/core/memory-store';

const ask = { invoice: 'INV-88', reason: 'over 5,000 EUR' };
const approve = { approved: true, by: 'Mara', note: '' };

// A tiny workflow: a model step, then an approval, then a booking.
async function workflow(store: MemoryStore, model: () => Promise<string>, book: () => Promise<string>) {
  const fields = await runStep(store, 'r', 'extract', {}, model);
  const d = await humanStep(store, 'r', 'approve', { ...ask, fields });
  if (!d.approved) return 'rejected';
  return runStep(store, 'r', 'post', {}, book);
}

describe('humanStep', () => {
  it('waits the first time and records it once', async () => {
    const store = new MemoryStore();
    await expect(humanStep(store, 'r', 'approve', ask)).rejects.toBeInstanceOf(WaitingForHuman);
    await expect(humanStep(store, 'r', 'approve', ask)).rejects.toBeInstanceOf(WaitingForHuman);
    expect(store.rows.filter((r) => r.key === 'approve')).toHaveLength(1);
  });

  it('continues after a decision without redoing earlier steps', async () => {
    const store = new MemoryStore();
    const model = vi.fn(async () => 'fields');
    const book = vi.fn(async () => 'booked');
    await expect(workflow(store, model, book)).rejects.toBeInstanceOf(WaitingForHuman);
    expect(await decide(store, 'r', 'approve', approve)).toEqual({ ok: true });
    expect(await workflow(store, model, book)).toBe('booked');
    expect(model).toHaveBeenCalledTimes(1);
    expect(book).toHaveBeenCalledTimes(1);
  });

  it('stops without booking when rejected', async () => {
    const store = new MemoryStore();
    const book = vi.fn(async () => 'booked');
    await workflow(store, async () => 'f', book).catch(() => {});
    await decide(store, 'r', 'approve', { approved: false, by: 'Mara', note: 'Duplicate of INV-80' });
    expect(await workflow(store, async () => 'f', book)).toBe('rejected');
    expect(book).not.toHaveBeenCalled();
  });
});

describe('decide', () => {
  it('refuses a decision when nothing is waiting', async () => {
    expect((await decide(new MemoryStore(), 'r', 'approve', approve)).ok).toBe(false);
  });
  it('refuses a second decision', async () => {
    const store = new MemoryStore();
    await humanStep(store, 'r', 'approve', ask).catch(() => {});
    await decide(store, 'r', 'approve', approve);
    expect(await decide(store, 'r', 'approve', { approved: false, by: 'Jo', note: 'changed my mind' })).toMatchObject({ ok: false });
  });
  it('needs a reason to reject', async () => {
    const store = new MemoryStore();
    await humanStep(store, 'r', 'approve', ask).catch(() => {});
    expect(await decide(store, 'r', 'approve', { approved: false, by: 'Mara', note: 'no' })).toMatchObject({ ok: false });
  });
});
