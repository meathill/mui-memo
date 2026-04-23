import { NextResponse } from "next/server";
import { requireAuthDb } from "@/lib/route";
import { markBatchDone } from "@/lib/tasks";
import { batchCompleteSchema } from "@mui-memo/shared/validators";

export async function POST(req: Request) {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  const body = await req.json().catch(() => null);
  const parsed = batchCompleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  await markBatchDone(ctx.db, ctx.session.user.id, parsed.data.taskIds);
  return NextResponse.json({ ok: true });
}
