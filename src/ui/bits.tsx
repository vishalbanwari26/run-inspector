import type { RunView } from '@/data/types';
import { RUN_TONE, STEPS, runTone, stepState, type StepState } from './meta';

export function RunPill({ run }: { run: RunView }) {
  const t = RUN_TONE[runTone(run)];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap ${t.cls}`}>
      <span className={`size-1.5 rounded-full bg-current ${run.status === 'running' ? 'pulse-dot' : ''}`} />
      {t.label}
    </span>
  );
}

export const STATE_DOT: Record<StepState, string> = {
  pending: 'bg-hover border border-line-strong',
  running: 'bg-accent pulse-dot',
  retrying: 'bg-accent pulse-dot',
  done: 'bg-better',
  failed: 'bg-worse',
  waiting: 'bg-unclear',
  unknown: 'bg-unclear',
};

export function StepDots({ run }: { run: RunView }) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1" title={`${s.label}: ${stepState(run, s.key)}`}>
          <span className={`size-2 rounded-full ${STATE_DOT[stepState(run, s.key)]}`} />
          {i < STEPS.length - 1 && <span className="h-px w-3 bg-line-strong" />}
        </span>
      ))}
    </div>
  );
}

export function Json({ value }: { value: unknown }) {
  return (
    <pre className="scroll-thin max-h-[260px] overflow-auto rounded-md border border-line bg-panel-2 p-2.5 font-mono text-[11.5px] leading-[1.55] text-muted">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
