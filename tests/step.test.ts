import { describe, expect, it, vi } from 'vitest';
import { runStep } from '@/core/step';
import { MemoryStore } from '@/core/memory-store';

describe('runStep', () => {
  it('runs a step and saves its output', async () => {
    const store = new MemoryStore();
    const out = await runStep(store, 'r1', 'extract', { text: 'x' }, async () => ({ total: 10 }));
    expect(out).toEqual({ total: 10 });
    expect(store.rows[0]).toMatchObject({ key: 'extract', attempt: 1, status: 'done', output: { total: 10 } });
  });

  it('does not run a step again once it succeeded', async () => {
    const store = new MemoryStore();
    const fn = vi.fn(async () => 'booked');
    await runStep(store, 'r1', 'post', {}, fn);
    expect(await runStep(store, 'r1', 'post', {}, fn)).toBe('booked');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('records a failure and re-throws it', async () => {
    const store = new MemoryStore();
    await expect(runStep(store, 'r1', 'match', {}, async () => { throw new Error('PO not found'); })).rejects.toThrow('PO not found');
    expect(store.rows[0]).toMatchObject({ status: 'failed', error: 'PO not found' });
  });

  it('starts a new attempt after a failure', async () => {
    const store = new MemoryStore();
    await runStep(store, 'r1', 'match', {}, async () => { throw new Error('timeout'); }).catch(() => {});
    await runStep(store, 'r1', 'match', {}, async () => 'ok');
    expect(store.rows.map((r) => [r.attempt, r.status])).toEqual([[1, 'failed'], [2, 'done']]);
  });

  it('runs again when a crash left the step marked running', async () => {
    const store = new MemoryStore();
    await store.start('r1', 'post', {}); // crashed before finish()
    const fn = vi.fn(async () => 'booked');
    await runStep(store, 'r1', 'post', {}, fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(store.rows.map((r) => r.attempt)).toEqual([1, 2]);
  });

  it('keeps runs apart', async () => {
    const store = new MemoryStore();
    const fn = vi.fn(async () => 1);
    await runStep(store, 'r1', 'extract', {}, fn);
    await runStep(store, 'r2', 'extract', {}, fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
