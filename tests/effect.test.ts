import { describe, expect, it } from 'vitest';
import { effectRef, once, type EffectTarget } from '@/core/effect';
import { classify, nextAction, permanent } from '@/core/errors';
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
    expect(await once(erp.target, 'r:post', false)).toEqual({ result: { ref: 'r:post', id: 'INV-1' }, reused: false });
  });

  it('reuses an earlier booking instead of booking again', async () => {
    const erp = fakeErp();
    await once(erp.target, 'r:post', false);
    expect((await once(erp.target, 'r:post', false)).reused).toBe(true);
    expect(erp.booked).toHaveLength(1);
  });

  it('survives a timeout after the ERP saved the booking', async () => {
    const erp = fakeErp();
    const store = new MemoryStore();
    erp.timeoutNext();
    const step = () => runStep(store, 'r', 'post_invoice', {}, () => once(erp.target, effectRef('r', 'post_invoice'), false));
    await expect(step()).rejects.toThrow('ERP timeout');
    const second = await step();
    expect(second.reused).toBe(true);
    expect(erp.booked).toHaveLength(1);
  });

  it('survives a crash between booking and saving the step', async () => {
    const erp = fakeErp();
    const store = new MemoryStore();
    await store.start('r', 'post_invoice', {});
    await once(erp.target, effectRef('r', 'post_invoice'), false); // booked, then the worker died
    const out = await runStep(store, 'r', 'post_invoice', {}, () => once(erp.target, effectRef('r', 'post_invoice'), false));
    expect(out.reused).toBe(true);
    expect(erp.booked).toHaveLength(1);
  });

  it('books separately for different runs', async () => {
    const erp = fakeErp();
    await once(erp.target, effectRef('r1', 'post_invoice'), false);
    await once(erp.target, effectRef('r2', 'post_invoice'), false);
    expect(erp.booked).toHaveLength(2);
  });
});

describe('once with a system that cannot be searched', () => {
  function mailServer(timeoutAfterSend = false) {
    const sent: string[] = [];
    const target: EffectTarget<{ ref: string }> = {
      perform: async (ref) => { sent.push(ref); if (timeoutAfterSend) throw new Error('Mail server timeout'); return { ref }; },
    };
    return { sent, target };
  }

  it('sends on the first try', async () => {
    const m = mailServer();
    expect(await once(m.target, 'r:notify', false)).toEqual({ result: { ref: 'r:notify' }, reused: false });
  });

  it('turns a timeout into an unknown outcome instead of a retry', async () => {
    const m = mailServer(true);
    const err = await once(m.target, 'r:notify', false).catch((e) => e);
    expect(classify(err)).toBe('unknown');
    expect(nextAction(classify(err), 1)).toEqual({ stop: true });
    expect(m.sent).toHaveLength(1);
  });

  it('refuses to send again when an earlier attempt may have sent', async () => {
    const m = mailServer();
    const err = await once(m.target, 'r:notify', true).catch((e) => e);
    expect(classify(err)).toBe('unknown');
    expect(m.sent).toHaveLength(0);
  });

  it('passes a clear rejection through as permanent', async () => {
    const target: EffectTarget<unknown> = { perform: async () => { throw permanent('Mailbox not found'); } };
    expect(classify(await once(target, 'r:notify', false).catch((e) => e))).toBe('permanent');
  });

  it('sends again with the same key to a system that drops repeats', async () => {
    const seen = new Map<string, number>();
    const target: EffectTarget<{ id: number }> = {
      idempotent: true,
      perform: async (ref) => { if (!seen.has(ref)) seen.set(ref, seen.size + 1); return { id: seen.get(ref)! }; },
    };
    const a = await once(target, 'r:pay', false);
    const b = await once(target, 'r:pay', true);
    expect(b.result).toEqual(a.result);
    expect(seen.size).toBe(1);
  });
});
