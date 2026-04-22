import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, sql } from "drizzle-orm";
import { tasks as tasksTable } from "@mui-memo/shared/schema";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);

  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      pending: sql<number>`sum(case when status = 'pending' then 1 else 0 end)`,
      doing: sql<number>`sum(case when status = 'doing' then 1 else 0 end)`,
      done: sql<number>`sum(case when status = 'done' then 1 else 0 end)`,
      doneToday: sql<number>`sum(case when status = 'done' and DATE(completed_at) = CURRENT_DATE() then 1 else 0 end)`,
    })
    .from(tasksTable)
    .where(eq(tasksTable.userId, session.user.id));

  return NextResponse.json({
    user: {
      name: session.user.name ?? session.user.email,
      email: session.user.email,
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
