import { NextResponse } from 'next/server';
import { requireAuthDb } from '@/lib/route';
import { reopenTask } from '@/lib/tasks';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  const { id } = await params;
  await reopenTask(ctx.db, ctx.session.user.id, id);
  return NextResponse.json({ ok: true });
}
