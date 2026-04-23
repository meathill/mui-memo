import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { listTasksForUser } from "@/lib/tasks";

/**
 * 返回当前用户的全量未归档任务视图。
 * 前端会把结果丢进 zustand，place 筛选 / rerank 都在客户端完成，
 * 切换场景不再发新请求。
 */
export async function GET() {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);
  const all = await listTasksForUser(db, session.user.id);
  // 只返回未完成的：done 的去 /completed 页看。linked 作为子任务保留，
  // applyIntent 期待 rerank 上下文里有 doing 父任务的 linked[]。
  const tasks = all.filter((t) => t.status !== "done");
  return NextResponse.json({ tasks });
}
