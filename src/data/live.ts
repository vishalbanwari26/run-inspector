// Reads runs from Postgres and shapes them for the pages.
import { createPrismaClient } from '@/lib/prisma';
import type { InvoiceInput } from '@/workflow/invoice';
import type { RunView } from './types';

const g = globalThis as unknown as { db?: ReturnType<typeof createPrismaClient> };
export const db = (g.db ??= createPrismaClient());

export async function loadRuns(id?: string): Promise<RunView[]> {
  const rows = await db.run.findMany({
    where: id ? { id } : {},
    orderBy: { createdAt: 'asc' },
    include: { steps: { orderBy: [{ startedAt: 'asc' }, { attempt: 'asc' }] } },
  });
  const ids = rows.map((r) => r.id);
  const [bookings, messages] = await Promise.all([
    db.erpInvoice.findMany({ where: { OR: ids.map((i) => ({ externalRef: { startsWith: `${i}:` } })) }, orderBy: { createdAt: 'asc' } }),
    db.erpMessage.findMany({ where: { OR: ids.map((i) => ({ externalRef: { startsWith: `${i}:` } })) }, orderBy: { createdAt: 'asc' } }),
  ]);
  return rows.map((r) => {
    const input = r.input as InvoiceInput;
    const steps: RunView['steps'] = {};
    for (const s of r.steps) {
      (steps[s.key] ??= []).push({
        attempt: s.attempt, status: s.status, input: s.input, output: s.output, error: s.error,
        errorKind: (s.errorKind as 'transient' | 'permanent' | 'unknown' | null) ?? null, invalidated: s.invalidated,
        startedAt: s.startedAt.toISOString(), endedAt: s.endedAt?.toISOString() ?? null,
      });
    }
    const mine = (ref: string) => ref.startsWith(`${r.id}:`);
    return {
      id: r.id, title: r.title, workflow: r.workflow, status: r.status, currentStep: r.currentStep, error: r.error,
      outcome: r.outcome ?? null, text: input.text, faults: (input.faults ?? {}) as Record<string, unknown>,
      overrides: (input.overrides ?? {}) as Record<string, unknown>,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), steps,
      effects: [
        ...bookings.filter((b) => mine(b.externalRef)).map((b) => ({ kind: 'booking' as const, id: b.id, externalRef: b.externalRef, summary: `${b.invoiceNumber} · ${Number(b.amount).toFixed(2)} ${b.currency} · ${b.poNumber}`, createdAt: b.createdAt.toISOString() })),
        ...messages.filter((m) => mine(m.externalRef)).map((m) => ({ kind: 'message' as const, id: m.id, externalRef: m.externalRef, summary: `to ${m.to}`, createdAt: m.createdAt.toISOString() })),
      ],
    };
  });
}
