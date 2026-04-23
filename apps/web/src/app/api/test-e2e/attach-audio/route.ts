import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { tasks as tasksTable } from "@mui-memo/shared/schema";
import { R2_PREFIX } from "@/lib/config";
import { ensureE2EEnabled } from "@/lib/e2e-guard";
import { requireAuthDb } from "@/lib/route";

/**
 * 测试辅助：往 R2 塞一条音频并挂到指定 taskId 上。
 * multipart: file (Blob), taskId (string), mime? (string)
 */
export async function POST(req: Request) {
  if (!(await ensureE2EEnabled())) {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  const userId = ctx.session.user.id;

  const form = await req.formData();
  const file = form.get("file");
  const taskId = String(form.get("taskId") ?? "");
  if (!(file instanceof Blob) || !taskId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const mime = String(form.get("mime") ?? file.type ?? "audio/webm");

  const bucket = ctx.env.AUDIO_BUCKET;
  if (!bucket)
    return NextResponse.json({ error: "r2_not_bound" }, { status: 500 });

  const ext = mime.includes("webm") ? "webm" : "bin";
  const key = `${R2_PREFIX}/audio/${userId}/${Date.now()}-test.${ext}`;
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: mime },
  });

  await ctx.db
    .update(tasksTable)
    .set({ audioKey: key, updatedAt: new Date() })
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)));

  return NextResponse.json({ ok: true, key });
}
