import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { attachments as attachmentsTable } from "@mui-memo/shared/schema";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);

  const [row] = await db
    .select({ key: attachmentsTable.key })
    .from(attachmentsTable)
    .where(
      and(
        eq(attachmentsTable.id, id),
        eq(attachmentsTable.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!row) return NextResponse.json({ ok: true }); // 幂等

  await db
    .delete(attachmentsTable)
    .where(
      and(
        eq(attachmentsTable.id, id),
        eq(attachmentsTable.userId, session.user.id),
      ),
    );

  const bucket = env.AUDIO_BUCKET;
  if (bucket) {
    // 失败不阻塞，DB 已清
    await bucket.delete(row.key).catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
