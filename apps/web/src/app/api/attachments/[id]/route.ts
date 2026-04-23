import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { attachments as attachmentsTable } from "@mui-memo/shared/schema";
import { requireAuthDb } from "@/lib/route";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  const { id } = await params;
  const userId = ctx.session.user.id;

  const [row] = await ctx.db
    .select({ key: attachmentsTable.key })
    .from(attachmentsTable)
    .where(
      and(eq(attachmentsTable.id, id), eq(attachmentsTable.userId, userId)),
    )
    .limit(1);

  if (!row) return NextResponse.json({ ok: true }); // 幂等

  await ctx.db
    .delete(attachmentsTable)
    .where(
      and(eq(attachmentsTable.id, id), eq(attachmentsTable.userId, userId)),
    );

  const bucket = ctx.env.AUDIO_BUCKET;
  if (bucket) {
    // 失败不阻塞，DB 已清
    await bucket.delete(row.key).catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
