import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/data/live';
import { runQueue } from '@/lib/queue';
import { decideRun } from '@/services/runs';

const queue = runQueue();
const Body = z.object({ approved: z.boolean(), note: z.string().max(2000).default('') });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ ok: false, reason: 'Invalid decision.' }, { status: 400 });
  const r = await decideRun(db, queue, id, { ...body.data, by: 'admin' });
  return NextResponse.json(r, { status: r.ok ? 200 : 409 });
}
