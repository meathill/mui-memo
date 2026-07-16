import {
  accounts,
  attachments as attachmentsTable,
  recurrences as recurrencesTable,
  sessions,
  tasks as tasksTable,
  users,
  utterances as utterancesTable,
} from "@mui-memo/shared/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuthDb } from "@/lib/route";

/**
 * 注销账号（Apple 5.1.1(v)）：永久删除当前登录用户的全部数据。
 *
 * 只删自己——用户 id 取自 session，不接受任何外部参数（与 test-e2e/cleanup
 * 按 email 删、走 e2e guard 不同）。级联顺序先子后父：先把附件的 R2 对象
 * best-effort 删掉，再清各业务表，最后删 Better-Auth 三表（session 在最后
 * 才删，保证整段逻辑跑完）。无事务——每步按 userId 独立，中途失败重试可补齐。
 */
export async function POST() {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  const { db, env } = ctx;
  const uid = ctx.session.user.id;

  // 1. 附件：先删 R2 对象（best effort，删不掉不阻塞注销），再删 DB 行
  const attRows = await db
    .select({ key: attachmentsTable.key })
    .from(attachmentsTable)
    .where(eq(attachmentsTable.userId, uid));
  const bucket = env.AUDIO_BUCKET;
  if (bucket && attRows.length) {
    await bucket.delete(attRows.map((r) => r.key)).catch(() => undefined);
  }
  await db.delete(attachmentsTable).where(eq(attachmentsTable.userId, uid));

  // 2. 业务表：输入记录 / 任务 / 周期任务定义
  await db.delete(utterancesTable).where(eq(utterancesTable.userId, uid));
  await db.delete(tasksTable).where(eq(tasksTable.userId, uid));
  await db.delete(recurrencesTable).where(eq(recurrencesTable.userId, uid));

  // 3. Better-Auth 三表：删 sessions 吊销所有会话，删 accounts 解绑 Apple/密码，最后删 user
  await db.delete(sessions).where(eq(sessions.userId, uid));
  await db.delete(accounts).where(eq(accounts.userId, uid));
  await db.delete(users).where(eq(users.id, uid));

  return NextResponse.json({ ok: true });
}
