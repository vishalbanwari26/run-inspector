import { describe, expect, it } from 'vitest';
import { classify, nextAction, permanent, transient, RETRY } from '@/core/errors';
import { runStep } from '@/core/step';
import { MemoryStore } from '@/core/memory-store';

describe('classify', () => {
  it('trusts the kind our own steps state', () => {
    expect(classify(transient('ERP timeout'))).toBe('transient');
    expect(classify(permanent('PO-4471 not found'))).toBe('permanent');
  });
  it('treats rate limits, timeouts and gateway errors as transient', () => {
    for (const m of ['model call failed: 429 Too Many Requests', 'Request timed out', 'socket ECONNRESET', '503 Service Unavailable'])
      expect(classify(new Error(m))).toBe('transient');
  });
  it('treats anything unknown as permanent', () => {
    expect(classify(new Error('Vendor account blocked'))).toBe('permanent');
    expect(classify('weird')).toBe('permanent');
  });
});

describe('nextAction', () => {
  it('backs off 2, 4, 8 seconds for transient errors', () => {
    expect([1, 2, 3].map((a) => nextAction('transient', a))).toEqual([{ retryInMs: 2000 }, { retryInMs: 4000 }, { retryInMs: 8000 }]);
  });
  it('stops after the last attempt even if transient', () => {
    expect(nextAction('transient', RETRY.maxAttempts)).toEqual({ stop: true });
  });
  it('never retries an unknown outcome', () => {
    expect(nextAction('unknown', 1)).toEqual({ stop: true });
  });
  it('stops at once for permanent errors', () => {
    expect(nextAction(classify(new Error('Vendor account blocked')), 1)).toEqual({ stop: true });
  });
});

describe('runStep saves the error kind', () => {
  it('stores transient or permanent with the failure', async () => {
    const store = new MemoryStore();
    await runStep(store, 'r', 'post', {}, async () => { throw new Error('429 rate limit'); }).catch(() => {});
    await runStep(store, 'r', 'match', {}, async () => { throw permanent('PO not found'); }).catch(() => {});
    expect(store.rows.map((r) => r.errorKind)).toEqual(['transient', 'permanent']);
  });
});
