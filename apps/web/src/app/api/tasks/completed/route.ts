import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, desc, eq } from "drizzle-orm";
import { tasks as tasksTable } from "@mui-memo/shared/schema";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);
  const rows = await db
    .select({
      id: tasksTable.id,
      text: tasksTable.text,
      tag: tasksTable.tag,
      completedAt: tasksTable.completedAt,
    })
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.userId, session.user.id),
        eq(tasksTable.status, "done"),
      ),
    )
    .orderBy(desc(tasksTable.completedAt))
    .limit(500);

  return NextResponse.json({
    tasks: rows.map((r) => ({
      id: r.id,
      text: r.text,
      tag: r.tag,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    })),
  });
}
