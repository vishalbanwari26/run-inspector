// Where the pages get their data: Postgres in the app, the snapshot in the demo.
import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { connection } from 'next/server';
import type { RunView } from './types';

const isStatic = process.env['STATIC'] === '1';
const fromSnapshot = () => JSON.parse(readFileSync(path.join(process.cwd(), 'fixtures/snapshot.json'), 'utf8')) as RunView[];

export async function allRuns(): Promise<RunView[]> {
  if (isStatic) return fromSnapshot();
  await connection();
  const { loadRuns } = await import('./live');
  return loadRuns();
}

export async function getRun(id: string): Promise<RunView | null> {
  if (isStatic) return fromSnapshot().find((r) => r.id === id) ?? null;
  await connection();
  const { loadRuns } = await import('./live');
  return (await loadRuns(id))[0] ?? null;
}
