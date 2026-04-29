import { attachments as attachmentsTable } from '@mui-memo/shared/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { streamR2Object, withHeadBodyStripped } from '@/lib/r2-stream';
import { requireAuthDb } from '@/lib/route';

/**
 * 私有附件流式返回。靠 DB 里 userId 做所有权校验。
 * 不走 /api/audio/[...key]：那个路径只给语音原声（muimemo/audio/ 前缀），
 * 这里覆盖任意类型的附件（muimemo/attachments/... 前缀）。
 *
 * GET / HEAD 都走 streamR2Object：iOS AVPlayer 播附件音频时同样要 Range/206。
 */
async function handle(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  return streamR2Object({
    bucket,
    key: row.key,
    request: req,
    fallbackContentType: row.mime ?? 'application/octet-stream',
  });
}

export const GET = handle;
// HEAD 走 wrapper 自动剥 body（同 audio 路由理由）
export const HEAD = withHeadBodyStripped(handle);

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
