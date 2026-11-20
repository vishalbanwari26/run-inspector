import { notFound } from 'next/navigation';
import { allRuns, getRun } from '@/data/source';
import { Shell } from '@/ui/shell';
import { RunPage } from '@/ui/run';

export async function generateStaticParams() {
  if (process.env['STATIC'] !== '1') return [];
  return (await allRuns()).map((r) => ({ id: r.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();
  return (
    <Shell crumbs={[{ label: 'Runs', href: '/' }, { label: run.title }]}>
      <RunPage run={run} />
    </Shell>
  );
}
