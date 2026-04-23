import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, desc, eq, lt } from "drizzle-orm";
import { utterances as utterancesTable } from "@mui-memo/shared/schema";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

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

  const conds = [eq(utterancesTable.userId, session.user.id)];
  if (before) {
    const d = new Date(before);
    if (!Number.isNaN(d.getTime()))
      conds.push(lt(utterancesTable.createdAt, d));
  }

  const rows = await db
    .select({
      id: utterancesTable.id,
      rawText: utterancesTable.rawText,
      intent: utterancesTable.intent,
      effectKind: utterancesTable.effectKind,
      verb: utterancesTable.verb,
      reason: utterancesTable.reason,
      taskId: utterancesTable.taskId,
      audioKey: utterancesTable.audioKey,
      createdAt: utterancesTable.createdAt,
    })
    .from(utterancesTable)
    .where(and(...conds))
    .orderBy(desc(utterancesTable.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
  const nextCursor = hasMore
    ? (items[items.length - 1]?.createdAt ?? null)
    : null;

  return NextResponse.json({ items, nextCursor, hasMore });
}
