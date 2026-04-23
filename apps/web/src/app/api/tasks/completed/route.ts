import { requireAuthDb } from '@/lib/route';
import { tasks as tasksTable } from '@mui-memo/shared/schema';
import { and, desc, eq, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * 已完成任务分页：按 completedAt DESC 排序，用 `before` 作为 cursor。
 * 首屏不传 `before`，拿最新 N 条；滚到底部再传最后一条的 completedAt 拉下一页。
 */
export async function GET(req: Request) {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;

  const url = new URL(req.url);
  const before = url.searchParams.get('before');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, MAX_LIMIT);

  const conds = [eq(tasksTable.userId, ctx.session.user.id), eq(tasksTable.status, 'done')];
  if (before) {
    const d = new Date(before);
    if (!Number.isNaN(d.getTime())) conds.push(lt(tasksTable.completedAt, d));
  }

  const rows = await ctx.db
    .select({
      id: tasksTable.id,
      text: tasksTable.text,
      tag: tasksTable.tag,
      completedAt: tasksTable.completedAt,
    })
    .from(tasksTable)
    .where(and(...conds))
    .orderBy(desc(tasksTable.completedAt))
    .limit(limit + 1); // 多取一条判断是否还有下一页

  const hasMore = rows.length > limit;
  const tasks = rows.slice(0, limit).map((r) => ({
    id: r.id,
    text: r.text,
    tag: r.tag,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
  }));
  const nextCursor = hasMore ? (tasks[tasks.length - 1]?.completedAt ?? null) : null;

  return NextResponse.json({ tasks, nextCursor, hasMore });
}
