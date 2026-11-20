import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/data/live';
import { runQueue } from '@/lib/queue';
import { resolveRun } from '@/services/runs';

const queue = runQueue();
const Body = z.object({ happened: z.boolean(), note: z.string().max(2000).default('') });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ ok: false, reason: 'Invalid answer.' }, { status: 400 });
  const r = await resolveRun(db, queue, id, { ...body.data, by: 'admin' });
  return NextResponse.json(r, { status: r.ok ? 200 : 409 });
}
