import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/data/live';
import { runQueue } from '@/lib/queue';
import { retryRun } from '@/services/runs';

const queue = runQueue();
const Body = z.object({ from: z.string(), poNumber: z.string().regex(/^PO-\d{4}$/).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ ok: false, reason: 'Use a purchase order number like PO-4473.' }, { status: 400 });
  const r = await retryRun(db, queue, id, body.data.from, body.data.poNumber ? { poNumber: body.data.poNumber } : undefined);
  return NextResponse.json(r, { status: r.ok ? 200 : 409 });
}
