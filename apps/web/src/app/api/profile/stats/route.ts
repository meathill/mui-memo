import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { tasks as tasksTable } from "@mui-memo/shared/schema";
import { requireAuthDb } from "@/lib/route";

export async function GET() {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;

  const [row] = await ctx.db
    .select({
      total: sql<number>`count(*)`,
      pending: sql<number>`sum(case when status = 'pending' then 1 else 0 end)`,
      doing: sql<number>`sum(case when status = 'doing' then 1 else 0 end)`,
      done: sql<number>`sum(case when status = 'done' then 1 else 0 end)`,
      doneToday: sql<number>`sum(case when status = 'done' and DATE(completed_at) = CURRENT_DATE() then 1 else 0 end)`,
    })
    .from(tasksTable)
    .where(eq(tasksTable.userId, ctx.session.user.id));

  return NextResponse.json({
    user: {
      name: ctx.session.user.name ?? ctx.session.user.email,
      email: ctx.session.user.email,
    },
    stats: {
      total: Number(row?.total ?? 0),
      pending: Number(row?.pending ?? 0),
      doing: Number(row?.doing ?? 0),
      done: Number(row?.done ?? 0),
      doneToday: Number(row?.doneToday ?? 0),
    },
  });
}
