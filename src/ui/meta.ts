// Names and kinds of the workflow steps, for display.
import { Calculator, FileSearch, Send, Sparkles, UserCheck, Database, type LucideIcon } from 'lucide-react';
import type { AttemptView, RunView } from '@/data/types';

export const STEPS: { key: string; label: string; kind: string; icon: LucideIcon; effect?: boolean }[] = [
  { key: 'extract', label: 'Read invoice', kind: 'model', icon: Sparkles },
  { key: 'check_totals', label: 'Check totals', kind: 'code', icon: Calculator },
  { key: 'match_po', label: 'Match purchase order', kind: 'ERP lookup', icon: FileSearch },
  { key: 'approve', label: 'Approval', kind: 'person', icon: UserCheck },
  { key: 'post_invoice', label: 'Book in ERP', kind: 'side effect', icon: Database, effect: true },
  { key: 'notify', label: 'Notify requester', kind: 'side effect', icon: Send, effect: true },
];
export const labelOf = (key: string | null) => STEPS.find((s) => s.key === key)?.label ?? key ?? '';

export type StepState = 'pending' | 'running' | 'done' | 'failed' | 'waiting' | 'retrying' | 'unknown';

export function valid(attempts: AttemptView[] | undefined) {
  return (attempts ?? []).filter((a) => !a.invalidated);
}

export function stepState(run: RunView, key: string): StepState {
  const last = valid(run.steps[key]).at(-1);
  if (!last) return 'pending';
  if (last.status === 'failed' && last.errorKind === 'unknown') return 'unknown';
  if (last.status === 'failed' && run.status === 'running' && run.currentStep === key) return 'retrying';
  return last.status;
}

export type RunTone = 'running' | 'waiting' | 'check' | 'failed' | 'booked' | 'rejected';
export const needsCheck = (run: RunView) =>
  run.status === 'failed' && !!run.currentStep && valid(run.steps[run.currentStep]).at(-1)?.errorKind === 'unknown';
export function runTone(run: RunView): RunTone {
  if (needsCheck(run)) return 'check';
  if (run.status === 'done') return (run.outcome as { result?: string } | null)?.result === 'rejected' ? 'rejected' : 'booked';
  return run.status;
}
export const RUN_TONE: Record<RunTone, { label: string; cls: string }> = {
  running: { label: 'Running', cls: 'text-accent bg-accent-soft' },
  waiting: { label: 'Waiting for you', cls: 'text-unclear bg-unclear-soft' },
  check: { label: 'Check needed', cls: 'text-unclear bg-unclear-soft' },
  failed: { label: 'Stopped, needs you', cls: 'text-worse bg-worse-soft' },
  booked: { label: 'Booked', cls: 'text-better bg-better-soft' },
  rejected: { label: 'Rejected', cls: 'text-same bg-same-soft' },
};

export function duration(a: AttemptView): string {
  if (!a.endedAt) return '';
  const ms = new Date(a.endedAt).getTime() - new Date(a.startedAt).getTime();
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

// One plain sentence per thing worth knowing about the run.
export function story(run: RunView): string[] {
  const out: string[] = [];
  for (const s of STEPS) {
    const all = run.steps[s.key] ?? [];
    const v = valid(all);
    const failed = v.filter((a) => a.status === 'failed');
    const last = v.at(-1);
    const reused = (last?.output as { reused?: boolean } | null)?.reused;
    const checkedBy = (last?.output as { checkedBy?: string } | null)?.checkedBy;
    if (checkedBy)
      out.push(`${s.label}: the outcome was unknown, so the run stopped. ${checkedBy} checked and it had gone out, so it was not sent again.`);
    else if (failed.length && last?.status === 'done')
      out.push(`${s.label}: ${failed.map((f) => f.error?.replace(/\s*\(injected.*?\)/, '')).join('; ')}. Done on attempt ${last.attempt}${reused ? `, which found the earlier ${s.key === 'notify' ? 'message' : 'booking'} and did not repeat it` : ''}.`);
    if (all.some((a) => a.invalidated))
      out.push(`${s.label}: ${all.filter((a) => a.invalidated).length} earlier result(s) set aside by a retry.`);
  }
  if (run.status === 'waiting') {
    const ask = valid(run.steps['approve']).at(-1)?.input as { reasons?: string[] } | undefined;
    out.push(`Waiting for approval: ${ask?.reasons?.join(', ') ?? 'needs a person'}.`);
  }
  if (needsCheck(run)) out.push(`${labelOf(run.currentStep)}: the call timed out after the message was handed over. It may have gone out, and this system cannot be checked, so the run stopped instead of sending again.`);
  else if (run.status === 'failed') out.push(`Stopped at ${labelOf(run.currentStep)}: ${run.error}`);
  if (run.status === 'done') {
    const o = run.outcome as { result: string; bookingId?: string; by?: string; note?: string };
    out.push(o.result === 'booked' ? `Booked once in the ERP and the requester was told.` : `Rejected by ${o.by}: ${o.note}`);
  }
  return out;
}
