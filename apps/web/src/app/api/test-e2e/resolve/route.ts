import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { ensureE2EEnabled } from "@/lib/e2e-guard";
import { resolveTargetTask } from "@/lib/search";
import type { Embedder } from "@/lib/embedding";

/**
 * 测试辅助：直接跑 resolveTargetTask 并返回结果。
 * body: { query: string, keyword?: string, fixedEmbedding?: number[] }
 *
 * - fixedEmbedding 存在 → 用固定向量当 embedder 结果，不走 Gemini
 * - 没 fixedEmbedding → 装一个会抛错的 embedder，退化为纯关键词匹配
 */
export async function POST(req: Request) {
  if (!(await ensureE2EEnabled())) {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    query?: string;
    keyword?: string;
    fixedEmbedding?: number[];
  } | null;
  if (!body?.query) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);

  const embedder: Embedder = body.fixedEmbedding
    ? async () => body.fixedEmbedding as number[]
    : async () => {
        throw new Error("no embedder in e2e");
      };

  const resolved = await resolveTargetTask(
    db,
    session.user.id,
    body.query,
    body.keyword,
    embedder,
  );
  return NextResponse.json({ resolved });
}
