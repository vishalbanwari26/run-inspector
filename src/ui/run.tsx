'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, CircleCheck, Info, RotateCw } from 'lucide-react';
import type { AttemptView, RunView } from '@/data/types';
import { RunPill, Json, STATE_DOT } from './bits';
import { STEPS, duration, labelOf, stepState, story, valid } from './meta';
import { Actions } from './actions';
import { timeAgo } from './time';

const isStatic = process.env['NEXT_PUBLIC_STATIC'] === '1';

export function RunPage({ run }: { run: RunView }) {
  const router = useRouter();
  const focus = run.currentStep ?? [...STEPS].reverse().find((s) => (run.steps[s.key] ?? []).length > 1)?.key ?? 'post_invoice';
  const [open, setOpen] = useState<Set<string>>(new Set([focus]));
  useEffect(() => {
    if (isStatic || run.status !== 'running') return;
    const t = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(t);
  }, [run.status, router]);
  const toggle = (k: string) => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const attempts = Object.values(run.steps).reduce((s, a) => s + a.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-x-2 text-muted">
            <span className="font-mono text-[12px]">invoice-to-erp</span><span className="text-faint">·</span><span className="font-mono text-[12px] text-faint">{run.id}</span>
          </div>
          <h1 className="flex flex-wrap items-center gap-3 text-[22px] font-semibold tracking-tight">{run.title}<RunPill run={run} /></h1>
        </div>
        <dl className="hidden grid-cols-3 gap-x-6 gap-y-1 text-[12px] sm:grid">
          <dt className="text-faint">Started</dt><dt className="text-faint">Updated</dt><dt className="text-faint">Step attempts</dt>
          <dd>{timeAgo(run.createdAt)}</dd><dd>{timeAgo(run.updatedAt)}</dd><dd className="tabular-nums">{attempts}</dd>
        </dl>
      </div>

      <div className="card p-4">
        <div className="mb-2 flex items-center gap-2 font-medium"><Info size={14} className="text-muted" />What happened</div>
        <ul className="space-y-1 text-muted">
          {story(run).map((s, i) => <li key={i} className="flex gap-2"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-faint" />{s}</li>)}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card overflow-hidden">
          <div className="border-b border-line px-4 py-2.5 text-[11.5px] font-medium uppercase tracking-wide text-faint">Steps</div>
          <ol>
            {STEPS.map((s, i) => {
              const state = stepState(run, s.key);
              const all = run.steps[s.key] ?? [];
              const isOpen = open.has(s.key);
              const Icon = s.icon;
              const last = valid(all).at(-1);
              const reused = (last?.output as { reused?: boolean } | null)?.reused;
              return (
                <li key={s.key} className="border-b border-line last:border-0">
                  <button onClick={() => toggle(s.key)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hover ${run.currentStep === s.key ? 'bg-hover/60' : ''}`}>
                    <span className="relative grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-panel-2 text-muted">
                      <Icon size={15} />
                      <span className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-[var(--panel)] ${STATE_DOT[state]}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{i + 1}. {s.label}</span>
                        <span className={`rounded px-1.5 text-[10.5px] font-medium ${s.effect ? 'bg-worse-soft text-worse' : 'bg-hover text-muted'}`}>{s.kind}</span>
                        {reused && <span className="rounded bg-better-soft px-1.5 text-[10.5px] font-medium text-better">found earlier result, not repeated</span>}
                      </span>
                      <span className="block text-[12px] text-faint">{stateText(state, all, last)}</span>
                    </span>
                    {all.length > 1 && <span className="rounded-full border border-line px-2 text-[11px] text-muted tabular-nums">{all.length} attempts</span>}
                    <ChevronDown size={15} className={`shrink-0 text-faint transition ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && <Attempts attempts={all} />}
                </li>
              );
            })}
          </ol>
        </div>
        <aside className="space-y-5 xl:sticky xl:top-[68px] xl:self-start">
          <Actions run={run} />
          <Effects run={run} />
          <div className="card overflow-hidden">
            <div className="border-b border-line px-4 py-2.5 font-medium">Source invoice</div>
            <pre className="scroll-thin overflow-x-auto p-4 font-mono text-[11px] leading-[1.6] text-muted">{run.text}</pre>
          </div>
        </aside>
      </div>
    </div>
  );
}

function stateText(state: string, all: AttemptView[], last?: AttemptView) {
  if (state === 'pending') return all.length ? 'Set aside by a retry, will run again' : 'Not reached yet';
  if (state === 'waiting') return 'Waiting for a person';
  if (state === 'retrying') return `Attempt ${last?.attempt} failed, retrying automatically`;
  if (state === 'failed') return `Stopped: ${last?.error ?? ''}`;
  if (state === 'running') return 'Running';
  const out = last?.output as { auto?: boolean; approved?: boolean; by?: string } | null;
  if (out?.auto) return 'Not needed: under the limit and matches the purchase order';
  if (out && 'approved' in out) return out.approved ? `Approved by ${out.by}` : `Rejected by ${out.by}`;
  return `Done${last ? ` in ${duration(last)}` : ''}`;
}

function Attempts({ attempts }: { attempts: AttemptView[] }) {
  if (attempts.length === 0) return <p className="px-4 pb-4 pl-[60px] text-faint">This step has not run.</p>;
  return (
    <div className="space-y-3 px-4 pb-4 pl-[60px]">
      {attempts.map((a) => (
        <div key={a.attempt} className={`rounded-lg border border-line bg-panel-2 ${a.invalidated ? 'opacity-50' : ''}`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-[12px]">
            <span className="font-medium">Attempt {a.attempt}</span>
            <span className={a.status === 'done' ? 'text-better' : a.status === 'failed' ? 'text-worse' : a.status === 'waiting' ? 'text-unclear' : 'text-accent'}>{a.status}</span>
            {a.errorKind && <span className={`rounded px-1 text-[10.5px] font-medium ${a.errorKind === 'transient' ? 'bg-accent-soft text-accent' : 'bg-worse-soft text-worse'}`}>
              {a.errorKind === 'transient' ? <><RotateCw size={9} className="mr-0.5 inline" />transient, retried</> : 'permanent, stopped'}</span>}
            {a.invalidated && <span className="rounded bg-hover px-1 text-[10.5px] text-muted">set aside by a retry</span>}
            <span className="ml-auto text-faint">{duration(a)}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
            {a.error && <div className="flex gap-2 rounded-md bg-worse-soft px-2.5 py-1.5 text-worse lg:col-span-2">{a.error}</div>}
            <div><div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-faint">Input</div><Json value={a.input} /></div>
            <div><div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-faint">Output</div>{a.output != null ? <Json value={a.output} /> : <p className="text-faint">None</p>}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Effects({ run }: { run: RunView }) {
  const bookings = run.effects.filter((e) => e.kind === 'booking').length;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="font-medium">Written to the ERP</span>
        {bookings <= 1 ? <span className="flex items-center gap-1 text-[12px] text-better"><CircleCheck size={13} />{bookings === 1 ? 'booked once' : 'nothing booked'}</span>
          : <span className="text-[12px] text-worse">{bookings} bookings</span>}
      </div>
      {run.effects.length === 0 ? <p className="px-4 py-3 text-faint">Nothing yet.</p> : (
        <ul className="divide-y divide-line">
          {run.effects.map((e) => (
            <li key={e.id} className="px-4 py-2.5">
              <div className="flex items-center gap-2"><span className="font-medium">{e.kind === 'booking' ? 'Booking' : 'Message'}</span><span className="text-muted">{e.summary}</span></div>
              <div className="font-mono text-[11px] text-faint">ref {e.externalRef}</div>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line px-4 py-2 text-[11.5px] text-faint">Every write carries a reference from the run and step. Before writing, the step looks for it, so a retry never writes twice.</p>
    </div>
  );
}
