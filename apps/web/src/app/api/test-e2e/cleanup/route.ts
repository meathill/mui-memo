import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, inArray, like, or } from "drizzle-orm";
import {
  accounts,
  sessions,
  tasks as tasksTable,
  users,
} from "@mui-memo/shared/schema";
import { createDb } from "@/lib/db";
import { ensureE2EEnabled } from "@/lib/e2e-guard";

/**
 * 测试清理：可选删除当前邮箱的所有 task / session / account / user。
 * body: { email: string, mode?: "tasks" | "user" }
 *   - tasks：仅清空任务（默认）
 *   - user：级联清除，相当于注销并重置
 */
export async function POST(req: Request) {
  if (!(await ensureE2EEnabled())) {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    mode?: "tasks" | "user";
  } | null;
  if (!body?.email) {
    return NextResponse.json({ error: "missing email" }, { status: 400 });
  }
  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);
  const mode = body.mode ?? "tasks";

  // 支持 SQL LIKE 里的 % 通配符，方便清一批 e2e+* 邮箱
  const emailIsPattern = body.email.includes("%");

  const matchedUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      emailIsPattern
        ? like(users.email, body.email)
        : eq(users.email, body.email),
    );
  const userIds = matchedUsers.map((u) => u.id);
  if (!userIds.length) return NextResponse.json({ ok: true, cleared: 0 });

  await db.delete(tasksTable).where(inArray(tasksTable.userId, userIds));

  if (mode === "user") {
    await db.delete(sessions).where(inArray(sessions.userId, userIds));
    await db.delete(accounts).where(inArray(accounts.userId, userIds));
    await db.delete(users).where(
      or(
        inArray(users.id, userIds),
        // paranoid fallback: also match by email pattern (in case partial deletes left orphans)
        emailIsPattern
          ? like(users.email, body.email)
          : eq(users.email, body.email),
      ),
    );
  }

  return NextResponse.json({ ok: true, cleared: userIds.length, mode });
}
