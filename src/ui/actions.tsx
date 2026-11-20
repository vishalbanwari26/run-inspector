'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Check, Loader2, RotateCw, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import type { RunView } from '@/data/types';
import { retryPlan } from '@/core/retry';
import { MIN_REJECT_NOTE } from '@/core/human';
import { PLAN, happenedSteps } from '@/workflow/plan';
import { labelOf, needsCheck, STEPS, valid } from './meta';

const isStatic = process.env['NEXT_PUBLIC_STATIC'] === '1';

function useAction(runId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function post(path: string, body: unknown, done: string) {
    setMsg(null);
    if (isStatic) return setMsg({ ok: true, text: `Demo only: in the app this would ${done}.` });
    setBusy(true);
    const res = await fetch(`/api/runs/${runId}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const r = (await res.json()) as { ok: boolean; reason?: string };
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.reason ?? 'Refused.' });
    router.refresh();
  }
  return { busy, msg, post };
}

export function Actions({ run }: { run: RunView }) {
  if (run.status === 'waiting') return <Approval run={run} />;
  if (needsCheck(run)) return <OutcomeCheck run={run} />;
  if (run.status === 'failed') return <Stopped run={run} />;
  if (run.status === 'running') return (
    <div className="card flex items-center gap-2 p-4 text-muted"><Loader2 size={15} className="animate-spin" />Running {labelOf(run.currentStep)}{run.error ? `, retrying after: ${run.error}` : ''}</div>
  );
  const o = run.outcome as { result: string; bookingId?: string; by?: string; note?: string };
  return o.result === 'booked' ? (
    <div className="card p-4"><div className="mb-1 flex items-center gap-2 font-medium text-better"><ShieldCheck size={16} />Booked</div><p className="text-muted">Booked in the ERP and the requester was told.</p></div>
  ) : (
    <div className="card p-4"><div className="mb-1 flex items-center gap-2 font-medium text-muted"><Ban size={16} />Rejected by {o.by}</div><p className="rounded-md border border-line bg-panel-2 p-2.5">{o.note}</p></div>
  );
}

function Approval({ run }: { run: RunView }) {
  const ask = valid(run.steps['approve']).at(-1)?.input as { reasons: string[]; vendor: string; invoiceNumber: string; total: number; currency: string; poNumber: string };
  const [note, setNote] = useState('');
  const { busy, msg, post } = useAction(run.id);
  const canReject = note.trim().length >= MIN_REJECT_NOTE;
  return (
    <div className="card p-4">
      <div className="mb-3 font-medium">Approval needed</div>
      <div className="mb-3 flex flex-wrap gap-1.5">{ask.reasons.map((r) => <span key={r} className="rounded-md bg-unclear-soft px-2 py-0.5 text-[12px] text-unclear">{r}</span>)}</div>
      <dl className="mb-3 grid grid-cols-[110px_1fr] gap-y-1 text-[12.5px]">
        <dt className="text-faint">Vendor</dt><dd>{ask.vendor}</dd>
        <dt className="text-faint">Invoice</dt><dd className="font-mono text-[12px]">{ask.invoiceNumber}</dd>
        <dt className="text-faint">Total</dt><dd className="font-medium tabular-nums">{ask.total.toLocaleString('en', { minimumFractionDigits: 2 })} {ask.currency}</dd>
        <dt className="text-faint">Purchase order</dt><dd className="font-mono text-[12px]">{ask.poNumber}</dd>
      </dl>
      <label htmlFor="note" className="mb-1 block text-[12px] text-muted">Note <span className="text-faint">(needed to reject)</span></label>
      <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why reject?"
        className="w-full resize-none rounded-lg border border-line bg-panel-2 px-3 py-2 outline-none placeholder:text-faint focus:border-accent/60 focus:ring-2 focus:ring-accent-soft" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button disabled={busy || !canReject} title={canReject ? '' : `Write at least ${MIN_REJECT_NOTE} characters`} onClick={() => post('decision', { approved: false, note }, 'reject the invoice and end the run')}
          className="rounded-lg border border-worse/40 px-3 py-2 font-medium text-worse hover:bg-worse-soft disabled:cursor-not-allowed disabled:opacity-40">Reject</button>
        <button disabled={busy} onClick={() => post('decision', { approved: true, note }, 'approve and continue to booking')}
          className="rounded-lg bg-accent px-3 py-2 font-medium text-white hover:brightness-110 disabled:opacity-40">Approve</button>
      </div>
      <Msg msg={msg} />
    </div>
  );
}

function Stopped({ run }: { run: RunView }) {
  const step = run.currentStep ?? '';
  const done = happenedSteps(Object.fromEntries(STEPS.map((s) => [s.key, valid(run.steps[s.key]).at(-1)])));
  const here = retryPlan(PLAN, done, step);
  const [po, setPo] = useState('');
  const { busy, msg, post } = useAction(run.id);
  const earlier = PLAN.order.slice(0, PLAN.order.indexOf(step));
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2 font-medium text-worse"><TriangleAlert size={16} />Stopped at {labelOf(step)}</div>
      <p className="mb-3 break-words rounded-md bg-worse-soft px-2.5 py-2 text-worse">{run.error}</p>
      <p className="mb-3 text-[12px] text-muted">This error does not fix itself, so the run waits for you instead of retrying.</p>
      {step === 'match_po' && (
        <div className="mb-3">
          <label htmlFor="po" className="mb-1 block text-[12px] text-muted">Correct purchase order and retry</label>
          <div className="flex gap-2">
            <input id="po" value={po} onChange={(e) => setPo(e.target.value)} placeholder="PO-4473"
              className="min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-3 py-1.5 font-mono text-[12px] outline-none placeholder:text-faint focus:border-accent/60" />
            <button disabled={busy || !/^PO-\d{4}$/.test(po)} onClick={() => post('retry', { from: 'match_po', poNumber: po }, `retry with ${po}; the approval will be asked again`)}
              className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-40">Retry</button>
          </div>
        </div>
      )}
      <button disabled={busy || !here.ok} onClick={() => post('retry', { from: step }, `run ${labelOf(step)} again`)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 font-medium hover:bg-hover disabled:opacity-40">
        <RotateCw size={13} />Retry {labelOf(step)}
      </button>
      {earlier.length > 0 && <EarlierSteps done={done} earlier={earlier} />}
      <Msg msg={msg} />
    </div>
  );
}

function OutcomeCheck({ run }: { run: RunView }) {
  const step = run.currentStep ?? '';
  const { busy, msg, post } = useAction(run.id);
  const input = valid(run.steps[step]).at(-1)?.input as { to?: string } | undefined;
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2 font-medium text-unclear"><TriangleAlert size={16} />Outcome unknown at {labelOf(step)}</div>
      <p className="mb-3 break-words rounded-md bg-unclear-soft px-2.5 py-2 text-unclear">{run.error}</p>
      <p className="mb-3 text-[12px] text-muted">
        The mail server cannot be searched for this message and does not drop repeats, so trying again could send it twice. The run stopped instead.
        Check {input?.to ? <span className="font-mono text-[11.5px] text-fg">{input.to}</span> : 'the mailbox'} or the sent folder, then tell the run what happened.
      </p>
      <div className="grid grid-cols-1 gap-2">
        <button disabled={busy} onClick={() => post('outcome', { happened: true, note: 'Found in the sent folder' }, 'mark the step done and continue without sending again')}
          className="rounded-lg bg-accent px-3 py-2 font-medium text-white hover:brightness-110 disabled:opacity-40">It went out, mark done</button>
        <button disabled={busy} onClick={() => post('outcome', { happened: false, note: '' }, 'set the uncertain attempt aside and send the message')}
          className="rounded-lg border border-line-strong px-3 py-2 font-medium hover:bg-hover disabled:opacity-40">It did not go out, send it</button>
      </div>
      <Msg msg={msg} />
    </div>
  );
}

function EarlierSteps({ done, earlier }: { done: Set<string>; earlier: string[] }) {
  const plans = earlier.map((k) => ({ k, p: retryPlan(PLAN, done, k) }));
  const happened = PLAN.effects.filter((k) => done.has(k)).map(labelOf);
  const refused = plans.filter((x) => !x.p.ok).length;
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-faint">Retry from an earlier step</div>
      <ul className="flex flex-wrap gap-1.5">
        {plans.map(({ k, p }) => (
          <li key={k} className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] ${p.ok ? 'border-line-strong' : 'border-line text-faint line-through decoration-faint/60'}`}>
            {p.ok ? <Check size={12} className="text-better" /> : <X size={12} className="text-worse" />}{labelOf(k)}
          </li>
        ))}
      </ul>
      {refused > 0 && (
        <p className="mt-2 text-[12px] text-muted">
          {happened.join(' and ')} already happened. Retrying from before {happened.length > 1 ? 'them' : 'it'} would do it again with new data, so it is blocked. Fix it in the ERP instead.
        </p>
      )}
    </div>
  );
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p className={`mt-3 text-[12px] ${msg.ok ? 'text-muted' : 'text-worse'}`}>{msg.text}</p>;
}
