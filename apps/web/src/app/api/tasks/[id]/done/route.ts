import { requireAuthDb } from '@/lib/route';
import { markTaskDone } from '@/lib/tasks';
import { NextResponse } from 'next/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  const { id } = await params;
  await markTaskDone(ctx.db, ctx.session.user.id, id);
  return NextResponse.json({ ok: true });
}
