import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { allRuns } from '@/data/source';
import { Shell } from '@/ui/shell';
import { RunPill, StepDots } from '@/ui/bits';
import { labelOf, runTone } from '@/ui/meta';
import { timeAgo } from '@/ui/time';

export default async function Home() {
  const runs = (await allRuns()).slice().reverse();
  const n = (t: string) => runs.filter((r) => runTone(r) === t).length;
  const tiles = [
    { label: 'Waiting for you', n: n('waiting') + n('check'), dot: 'bg-unclear', hint: 'Approve, reject, or check an outcome' },
    { label: 'Stopped', n: n('failed'), dot: 'bg-worse', hint: 'Retrying alone would not help' },
    { label: 'Running', n: n('running'), dot: 'bg-accent', hint: 'Including automatic retries' },
    { label: 'Finished', n: n('booked') + n('rejected'), dot: 'bg-better', hint: 'Booked or rejected' },
  ];
  return (
    <Shell crumbs={[{ label: 'Runs' }]}>
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold tracking-tight">Invoice to ERP</h1>
        <p className="mt-1 max-w-[680px] text-muted">
          An agent reads each invoice, checks it, matches the purchase order, asks a person when needed, books it in the ERP and tells the requester.
          Every step and every attempt is kept, so you can see what happened and step in safely.
        </p>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card min-w-0 px-4 py-3">
            <div className="flex items-center gap-1.5 text-muted"><span className={`size-2 rounded-sm ${t.dot}`} />{t.label}</div>
            <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight">{t.n}</div>
            <div className="text-[11.5px] text-faint">{t.hint}</div>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,2.2fr)_150px_minmax(0,1.6fr)_minmax(0,1.4fr)_90px_20px] gap-5 border-b border-line px-5 py-2.5 text-[11.5px] font-medium uppercase tracking-wide text-faint lg:grid">
          <span>Run</span><span>Status</span><span>Steps</span><span>Now at</span><span>Updated</span><span />
        </div>
        {runs.length === 0 && <p className="px-5 py-10 text-center text-muted">No runs yet. Run <code>npm run demo</code>.</p>}
        {runs.map((r) => (
          <Link key={r.id} href={`/runs/${r.id}`}
            className="group grid grid-cols-[minmax(0,1fr)] gap-2 border-b border-line px-5 py-3.5 last:border-0 hover:bg-hover lg:grid-cols-[minmax(0,2.2fr)_150px_minmax(0,1.6fr)_minmax(0,1.4fr)_90px_20px] lg:items-center lg:gap-5">
            <div className="min-w-0">
              <div className="truncate font-medium">{r.title}</div>
              <div className="truncate font-mono text-[11.5px] text-faint">{r.id}</div>
            </div>
            <div><RunPill run={r} /></div>
            <StepDots run={r} />
            <div className="truncate text-muted">
              {r.status === 'done' ? '' : labelOf(r.currentStep)}
              {r.status === 'failed' && r.error && <span className="text-faint"> · {r.error}</span>}
            </div>
            <div className="text-muted">{timeAgo(r.updatedAt)}</div>
            <ArrowRight size={15} className="hidden text-faint transition group-hover:translate-x-0.5 group-hover:text-fg lg:block" />
          </Link>
        ))}
      </div>
    </Shell>
  );
}
