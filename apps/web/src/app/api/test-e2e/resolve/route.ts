import { NextResponse } from "next/server";
import { ensureE2EEnabled } from "@/lib/e2e-guard";
import { requireAuthDb } from "@/lib/route";
import { resolveTargetTask } from "@/lib/search";

/**
 * 测试辅助：直接跑 resolveTargetTask 并返回结果。
 * body: { query: string, keyword?: string }
 * TiDB 自己做嵌入，不再需要外部 embedding。
 */
export async function POST(req: Request) {
  if (!(await ensureE2EEnabled())) {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;

  const body = (await req.json().catch(() => null)) as {
    query?: string;
    keyword?: string;
  } | null;
  if (!body?.query) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const resolved = await resolveTargetTask(
    ctx.db,
    ctx.session.user.id,
    body.query,
    body.keyword,
  );
  return NextResponse.json({ resolved });
}
