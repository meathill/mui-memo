import { updateRecurrenceSchema } from "@mui-memo/shared/validators";
import { NextResponse } from "next/server";
import {
	deleteRecurrence,
	getRecurrence,
	updateRecurrence,
} from "@/lib/recurrences";
import { requireAuthDb } from "@/lib/route";

export async function PATCH(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const [resp, ctx] = await requireAuthDb();
	if (resp) return resp;
	const { id } = await params;
	const body = await req.json().catch(() => null);
	const parsed = updateRecurrenceSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "invalid_input", issues: parsed.error.issues },
			{ status: 400 },
		);
	}
	const userId = ctx.session.user.id;
	const existing = await getRecurrence(ctx.db, userId, id);
	if (!existing)
		return NextResponse.json({ error: "not_found" }, { status: 404 });
	await updateRecurrence(ctx.db, userId, id, parsed.data);
	return NextResponse.json({ ok: true });
}

/** 关闭重复：删定义 + unlink 未完成实例（保留），done 实例留作历史。幂等。 */
export async function DELETE(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const [resp, ctx] = await requireAuthDb();
	if (resp) return resp;
	const { id } = await params;
	await deleteRecurrence(ctx.db, ctx.session.user.id, id);
	return NextResponse.json({ ok: true });
}
