// Postgres implementations of the step store and the run repository.
import type { Prisma, PrismaClient } from '@prisma/client';
import type { StepRecord, StepResult, StepStore } from '@/core/step';
import type { RunPatch, RunRepo, RunState } from '@/engine/advance';

const json = (v: unknown) => (v === undefined ? undefined : (v as Prisma.InputJsonValue));

export class PrismaStepStore implements StepStore {
  constructor(private db: PrismaClient) {}
  async lastValid(runId: string, key: string): Promise<StepRecord | null> {
    const r = await this.db.stepRun.findFirst({ where: { runId, key, invalidated: false }, orderBy: { attempt: 'desc' } });
    return r && { key: r.key, attempt: r.attempt, status: r.status, output: r.output ?? undefined, error: r.error ?? undefined, errorKind: (r.errorKind as StepRecord['errorKind']) ?? undefined };
  }
  async start(runId: string, key: string, input: unknown) {
    const last = await this.db.stepRun.findFirst({ where: { runId, key }, orderBy: { attempt: 'desc' }, select: { attempt: true } });
    const attempt = (last?.attempt ?? 0) + 1;
    await this.db.stepRun.create({ data: { runId, key, attempt, status: 'running', input: json(input) } });
    return attempt;
  }
  async finish(runId: string, key: string, attempt: number, r: StepResult) {
    await this.db.stepRun.update({
      where: { runId_key_attempt: { runId, key, attempt } },
      data: { status: r.status, output: json(r.output), error: r.error ?? null, errorKind: r.errorKind ?? null, endedAt: r.status === 'waiting' ? null : new Date() },
    });
  }
}

export class PrismaRunRepo implements RunRepo {
  constructor(private db: PrismaClient) {}
  async get(id: string): Promise<RunState> {
    const r = await this.db.run.findUniqueOrThrow({ where: { id } });
    return { id: r.id, status: r.status, input: r.input, currentStep: r.currentStep };
  }
  async update(id: string, p: RunPatch) {
    await this.db.run.update({ where: { id }, data: { status: p.status, currentStep: p.currentStep, error: p.error, outcome: json(p.outcome) } });
  }
  async lastFailure(id: string) {
    const r = await this.db.stepRun.findFirst({ where: { runId: id, status: 'failed' }, orderBy: { startedAt: 'desc' } });
    return r && { key: r.key, attempt: r.attempt };
  }
}
