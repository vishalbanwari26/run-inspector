// An in-memory StepStore for tests and the chaos test's fast mode.
import type { StepRecord, StepResult, StepStore } from './step';

type Row = StepRecord & { runId: string; input: unknown; invalidated: boolean };

export class MemoryStore implements StepStore {
  rows: Row[] = [];

  async lastValid(runId: string, key: string) {
    const rows = this.rows.filter((r) => r.runId === runId && r.key === key && !r.invalidated);
    return rows.at(-1) ?? null;
  }
  async attempts(runId: string, key: string) {
    return this.rows.filter((r) => r.runId === runId && r.key === key && !r.invalidated);
  }
  async invalidate(runId: string, keys: string[]) {
    for (const r of this.rows) if (r.runId === runId && keys.includes(r.key)) r.invalidated = true;
  }
  async start(runId: string, key: string, input: unknown) {
    const attempt = this.rows.filter((r) => r.runId === runId && r.key === key).length + 1;
    this.rows.push({ runId, key, attempt, status: 'running', input, invalidated: false });
    return attempt;
  }
  async finish(runId: string, key: string, attempt: number, result: StepResult) {
    const row = this.rows.find((r) => r.runId === runId && r.key === key && r.attempt === attempt);
    if (row) Object.assign(row, result);
  }
}
