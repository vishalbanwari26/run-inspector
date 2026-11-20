import { describe, expect, it } from 'vitest';
import { effectRef, once, type EffectTarget } from '@/core/effect';
import { runStep } from '@/core/step';
import { MemoryStore } from '@/core/memory-store';

// A fake ERP that accepts duplicates, like many real ones, and can be told to
// save a booking and then lose the response.
function fakeErp() {
  const booked: { ref: string; id: string }[] = [];
  let timeoutAfterSave = 0;
  const target: EffectTarget<{ id: string }> = {
    find: async (ref) => booked.find((b) => b.ref === ref) ?? null,
    perform: async (ref) => {
      const row = { ref, id: `INV-${booked.length + 1}` };
      booked.push(row);
      if (timeoutAfterSave > 0) { timeoutAfterSave--; throw new Error('ERP timeout'); }
      return row;
    },
  };
  return { booked, target, timeoutNext: () => { timeoutAfterSave++; } };
}

describe('effectRef', () => {
  it('is the same for every attempt of a step', () => {
    expect(effectRef('run1', 'post_invoice')).toBe('run1:post_invoice');
  });
});

describe('once', () => {
  it('performs the effect the first time', async () => {
    const erp = fakeErp();
    expect(await once(erp.target, 'r:post')).toEqual({ result: { ref: 'r:post', id: 'INV-1' }, reused: false });
  });

  it('reuses an earlier booking instead of booking again', async () => {
    const erp = fakeErp();
    await once(erp.target, 'r:post');
    expect((await once(erp.target, 'r:post')).reused).toBe(true);
    expect(erp.booked).toHaveLength(1);
  });

  it('survives a timeout after the ERP saved the booking', async () => {
    const erp = fakeErp();
    const store = new MemoryStore();
    erp.timeoutNext();
    const step = () => runStep(store, 'r', 'post_invoice', {}, () => once(erp.target, effectRef('r', 'post_invoice')));
    await expect(step()).rejects.toThrow('ERP timeout');
    const second = await step();
    expect(second.reused).toBe(true);
    expect(erp.booked).toHaveLength(1);
  });

  it('survives a crash between booking and saving the step', async () => {
    const erp = fakeErp();
    const store = new MemoryStore();
    await store.start('r', 'post_invoice', {});
    await once(erp.target, effectRef('r', 'post_invoice')); // booked, then the worker died
    const out = await runStep(store, 'r', 'post_invoice', {}, () => once(erp.target, effectRef('r', 'post_invoice')));
    expect(out.reused).toBe(true);
    expect(erp.booked).toHaveLength(1);
  });

  it('books separately for different runs', async () => {
    const erp = fakeErp();
    await once(erp.target, effectRef('r1', 'post_invoice'));
    await once(erp.target, effectRef('r2', 'post_invoice'));
    expect(erp.booked).toHaveLength(2);
  });
});
