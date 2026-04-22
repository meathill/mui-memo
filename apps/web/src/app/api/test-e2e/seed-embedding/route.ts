import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { EMBEDDING_DIM, tasks as tasksTable } from "@mui-memo/shared/schema";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { ensureE2EEnabled } from "@/lib/e2e-guard";

/**
 * 测试辅助：给一条任务强制写入一个 768 维向量。
 * 用来构造「语义命中」场景而不依赖真实 Gemini。
 */
export async function POST(req: Request) {
  if (!(await ensureE2EEnabled())) {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    taskId?: string;
    embedding?: number[];
  } | null;
  if (!body?.taskId || !Array.isArray(body.embedding)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (body.embedding.length !== EMBEDDING_DIM) {
    return NextResponse.json(
      { error: "wrong_dim", expected: EMBEDDING_DIM },
      { status: 400 },
    );
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);
  await db
    .update(tasksTable)
    .set({ embedding: body.embedding, updatedAt: new Date() })
    .where(
      and(
        eq(tasksTable.id, body.taskId),
        eq(tasksTable.userId, session.user.id),
      ),
    );

  return NextResponse.json({ ok: true });
}
