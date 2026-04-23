import { requireAuthDb } from '@/lib/route';
import { attachments as attachmentsTable } from '@mui-memo/shared/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * 私有附件流式返回。靠 DB 里 userId 做所有权校验。
 * 不走 /api/audio/[...key]：那个路径只给语音原声（muimemo/audio/ 前缀），
 * 这里覆盖任意类型的附件（muimemo/attachments/... 前缀）。
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  const { id } = await params;
  const userId = ctx.session.user.id;

  const [row] = await ctx.db
    .select({ key: attachmentsTable.key, mime: attachmentsTable.mime })
    .from(attachmentsTable)
    .where(and(eq(attachmentsTable.id, id), eq(attachmentsTable.userId, userId)))
    .limit(1);
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const bucket = ctx.env.AUDIO_BUCKET;
  if (!bucket) return NextResponse.json({ error: 'r2_not_bound' }, { status: 500 });

  const obj = await bucket.get(row.key);
  if (!obj) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? row.mime ?? 'application/octet-stream',
      'cache-control': 'private, max-age=31536000, immutable',
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  const { id } = await params;
  const userId = ctx.session.user.id;

  const [row] = await ctx.db
    .select({ key: attachmentsTable.key })
    .from(attachmentsTable)
    .where(and(eq(attachmentsTable.id, id), eq(attachmentsTable.userId, userId)))
    .limit(1);

  if (!row) return NextResponse.json({ ok: true }); // 幂等

  await ctx.db.delete(attachmentsTable).where(and(eq(attachmentsTable.id, id), eq(attachmentsTable.userId, userId)));

  const bucket = ctx.env.AUDIO_BUCKET;
  if (bucket) {
    // 失败不阻塞，DB 已清
    await bucket.delete(row.key).catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
