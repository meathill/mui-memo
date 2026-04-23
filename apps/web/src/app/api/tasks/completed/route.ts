import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, desc, eq, lt } from "drizzle-orm";
import { tasks as tasksTable } from "@mui-memo/shared/schema";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * 已完成任务分页：按 completedAt DESC 排序，用 `before` 作为 cursor。
 * 首屏不传 `before`，拿最新 N 条；滚到底部再传最后一条的 completedAt 拉下一页。
 */
export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);

  const conds = [
    eq(tasksTable.userId, session.user.id),
    eq(tasksTable.status, "done"),
  ];
  if (before) {
    const d = new Date(before);
    if (!Number.isNaN(d.getTime())) conds.push(lt(tasksTable.completedAt, d));
  }

  const rows = await db
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
  const nextCursor = hasMore
    ? (tasks[tasks.length - 1]?.completedAt ?? null)
    : null;

  return NextResponse.json({ tasks, nextCursor, hasMore });
}
