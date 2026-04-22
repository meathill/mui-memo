import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { tasks as tasksTable } from "@mui-memo/shared/schema";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { R2_PREFIX } from "@/lib/config";
import { ensureE2EEnabled } from "@/lib/e2e-guard";

/**
 * 测试辅助：往 R2 塞一条音频并挂到指定 taskId 上。
 * multipart: file (Blob), taskId (string), mime? (string)
 */
export async function POST(req: Request) {
  if (!(await ensureE2EEnabled())) {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const taskId = String(form.get("taskId") ?? "");
  if (!(file instanceof Blob) || !taskId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const mime = String(form.get("mime") ?? file.type ?? "audio/webm");

  const { env } = await getCloudflareContext({ async: true });
  const bucket = env.AUDIO_BUCKET;
  if (!bucket)
    return NextResponse.json({ error: "r2_not_bound" }, { status: 500 });

  const ext = mime.includes("webm") ? "webm" : "bin";
  const key = `${R2_PREFIX}/audio/${session.user.id}/${Date.now()}-test.${ext}`;
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: mime },
  });

  const db = createDb(env.TIDB_DATABASE_URL);
  await db
    .update(tasksTable)
    .set({ audioKey: key, updatedAt: new Date() })
    .where(
      and(eq(tasksTable.id, taskId), eq(tasksTable.userId, session.user.id)),
    );

  return NextResponse.json({ ok: true, key });
}
