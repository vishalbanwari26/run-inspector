// In-memory run repository for tests and the chaos test.
import type { MemoryStore } from '@/core/memory-store';
import type { RunPatch, RunRepo, RunState } from './advance';

export class MemoryRuns implements RunRepo {
  runs = new Map<string, RunState & { error?: string | null; outcome?: unknown }>();
  constructor(private store: MemoryStore) {}
  add(id: string, input: unknown) { this.runs.set(id, { id, status: 'running', input, currentStep: null }); }
  async get(id: string) { return { ...this.runs.get(id)! }; }
  async update(id: string, p: RunPatch) { Object.assign(this.runs.get(id)!, Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))); }
  async lastFailure(id: string) {
    const r = this.store.rows.filter((x) => x.runId === id && x.status === 'failed').at(-1);
    return r ? { key: r.key, attempt: r.attempt } : null;
  }
}
