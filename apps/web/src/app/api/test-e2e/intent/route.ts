import {
	applyActions,
	type IntentEffect,
	rerank,
} from "@mui-memo/shared/logic";
import {
	type Action,
	parseUtteranceFlexible,
	taskPlaceEnum,
	type Utterance,
} from "@mui-memo/shared/validators";
import { NextResponse } from "next/server";
import { ensureE2EEnabled } from "@/lib/e2e-guard";
import { requireAuthDb } from "@/lib/route";
import { resolveTargetTask } from "@/lib/search";
import {
	listTasksForUser,
	logUtterance,
	persistIntentResult,
} from "@/lib/tasks";

const RESOLVE_INTENTS = new Set<Action["intent"]>([
	"STATUS",
	"DONE",
	"MODIFY",
	"LINK",
]);

function hasMatch(
	action: Action,
): action is Extract<Action, { match?: string; matchId?: string }> {
	return action.intent !== "ADD";
}

/**
 * E2E 注入端点：接收 JSON utterance（新或老 schema 都支持），跑 applyActions + 持久化。
 * 仅在 E2E_ENABLED=1 时启用。skipResolve=true 则不跑 hybrid 搜索（适合刚写入还没 embedding 的场景）。
 *
 * 为了兼容老 spec，response 仍带 effect = effects[0]。
 */
export async function POST(req: Request) {
	if (!(await ensureE2EEnabled())) {
		return NextResponse.json({ error: "disabled" }, { status: 404 });
	}
	const [resp, ctx] = await requireAuthDb();
	if (resp) return resp;
	const userId = ctx.session.user.id;

	const body = (await req.json().catch(() => null)) as {
		utterance?: unknown;
		place?: unknown;
		skipResolve?: boolean;
	} | null;
	if (!body)
		return NextResponse.json({ error: "invalid body" }, { status: 400 });

	let utterance: Utterance;
	try {
		utterance = parseUtteranceFlexible(body.utterance);
	} catch (err) {
		const issues = err instanceof Error ? err.message : "parse failed";
		return NextResponse.json(
			{ error: "invalid utterance", issues },
			{ status: 400 },
		);
	}

	const placeParsed = taskPlaceEnum.safeParse(body.place ?? "any");
	const ctxPlace = placeParsed.success ? placeParsed.data : "any";

	const tasksBefore = await listTasksForUser(ctx.db, userId);

	if (!body.skipResolve) {
		await Promise.all(
			utterance.actions.map(async (action) => {
				if (!RESOLVE_INTENTS.has(action.intent)) return;
				if (!hasMatch(action)) return;
				try {
					const query = action.match?.trim() || utterance.raw;
					const resolved = await resolveTargetTask(
						ctx.db,
						userId,
						query,
						action.match,
					);
					if (resolved) (action as { matchId?: string }).matchId = resolved.id;
				} catch {}
			}),
		);
	}

	const { tasks: tasksAfter, effects } = applyActions(tasksBefore, utterance);
	try {
		await persistIntentResult(ctx.db, userId, tasksBefore, tasksAfter);
	} catch (err) {
		const msg =
			err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
		console.error("[test-e2e/intent] persist failed:", msg);
		return NextResponse.json(
			{ error: "persist_failed", detail: msg },
			{ status: 500 },
		);
	}

	await logUtterance(ctx.db, userId, utterance, effects, null).catch(
		() => undefined,
	);

	const ranked = rerank(tasksAfter, ctxPlace);
	// 兼容老 spec：单 effect 字段。多 action 时返回 effects[0]。
	const effect: IntentEffect | null = effects[0] ?? null;
	return NextResponse.json({
		utterance,
		effect,
		effects,
		tasks: tasksAfter,
		ranked,
	});
}
