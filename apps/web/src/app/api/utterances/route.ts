import { requireAuthDb } from '@/lib/route';
import { utterances as utterancesTable } from '@mui-memo/shared/schema';
import { and, desc, eq, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export async function GET(req: Request) {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;

  const url = new URL(req.url);
  const before = url.searchParams.get('before');
  const limit = Math.min(
    Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  const conds = [eq(utterancesTable.userId, ctx.session.user.id)];
  if (before) {
    const d = new Date(before);
    if (!Number.isNaN(d.getTime())) conds.push(lt(utterancesTable.createdAt, d));
  }

  const rows = await ctx.db
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
  const nextCursor = hasMore ? (items[items.length - 1]?.createdAt ?? null) : null;

  return NextResponse.json({ items, nextCursor, hasMore });
}
