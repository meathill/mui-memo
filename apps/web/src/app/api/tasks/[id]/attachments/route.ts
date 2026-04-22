import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import {
  attachments as attachmentsTable,
  tasks as tasksTable,
} from "@mui-memo/shared/schema";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { MAX_ATTACHMENT_SIZE, R2_PREFIX } from "@/lib/config";

function genId() {
  return crypto.randomUUID();
}

/**
 * 上传附件到 R2 并写 DB 记录。
 * 请求体：multipart/form-data，字段名 "file"。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: taskId } = await params;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return NextResponse.json(
      { error: "too_large", max: MAX_ATTACHMENT_SIZE },
      { status: 413 },
    );
  }

  const originalName =
    typeof (file as File).name === "string" ? (file as File).name : "file";
  const mime = file.type || "application/octet-stream";

  const { env } = await getCloudflareContext({ async: true });
  const bucket = env.AUDIO_BUCKET;
  if (!bucket) {
    return NextResponse.json({ error: "r2_not_bound" }, { status: 500 });
  }
  const db = createDb(env.TIDB_DATABASE_URL);

  // 校验 task 归属
  const [task] = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(
      and(eq(tasksTable.id, taskId), eq(tasksTable.userId, session.user.id)),
    )
    .limit(1);
  if (!task)
    return NextResponse.json({ error: "task_not_found" }, { status: 404 });

  const attId = genId();
  // 文件名里的特殊字符统一替换成 -，避免 URL 解析麻烦
  const safeName = originalName.replace(/[^\w.\-]+/g, "-").slice(0, 120);
  const key = `${R2_PREFIX}/attachments/${session.user.id}/${taskId}/${attId}-${safeName}`;

  const buffer = await file.arrayBuffer();
  await bucket.put(key, buffer, { httpMetadata: { contentType: mime } });

  await db.insert(attachmentsTable).values({
    id: attId,
    taskId,
    userId: session.user.id,
    key,
    mime,
    size: file.size,
    originalName: safeName,
  });

  return NextResponse.json({
    attachment: {
      id: attId,
      key,
      mime,
      size: file.size,
      originalName: safeName,
      createdAt: new Date().toISOString(),
    },
  });
}
