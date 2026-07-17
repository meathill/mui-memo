import { describe, expect, it } from "vitest";
import {
	actionSchema,
	intentConfirmSchema,
	legacyToActions,
	legacyUtteranceSchema,
	parseUtteranceFlexible,
	updateTaskSchema,
	utteranceSchema,
} from "./validators.js";

describe("utteranceSchema", () => {
	it("ADD 意图最小载荷可通过，actions[0] 字段取默认值", () => {
		const parsed = utteranceSchema.parse({
			raw: "晚上下班带点水",
			actions: [{ intent: "ADD", task: { text: "带水" } }],
		});
		expect(parsed.actions[0].intent).toBe("ADD");
		expect(parsed.dims).toEqual([]);
		expect(parsed.actions[0].aiReason).toBe("");
		expect(parsed.actions[0].aiVerb).toBe("");
		if (parsed.actions[0].intent !== "ADD") throw new Error("expected ADD");
		expect(parsed.actions[0].task?.text).toBe("带水");
		expect(parsed.actions[0].task?.place).toBe("any");
		expect(parsed.actions[0].task?.window).toBe("today");
	});

	it("多个 action 可以共存：一句话拆出两个 ADD", () => {
		const parsed = utteranceSchema.parse({
			raw: "提供货单给高老师，再提供快递单号",
			actions: [
				{ intent: "ADD", task: { text: "提供货单给高老师" } },
				{ intent: "ADD", task: { text: "提供快递单号" } },
			],
		});
		expect(parsed.actions).toHaveLength(2);
		expect(parsed.actions.every((a) => a.intent === "ADD")).toBe(true);
	});

	it("actions 数组不能为空", () => {
		const res = utteranceSchema.safeParse({ raw: "x", actions: [] });
		expect(res.success).toBe(false);
	});

	it("未知 intent 被拒绝", () => {
		const res = utteranceSchema.safeParse({
			raw: "x",
			actions: [{ intent: "UNKNOWN" }],
		});
		expect(res.success).toBe(false);
	});

	it("dim 的默认 tone 是 mute", () => {
		const parsed = utteranceSchema.parse({
			raw: "x",
			actions: [{ intent: "DONE" }],
			dims: [{ kind: "intent", label: "已完成" }],
		});
		expect(parsed.dims[0].tone).toBe("mute");
		expect(parsed.dims[0].hint).toBe("");
	});

	it("matchId 可选，传入后保留在 action 上", () => {
		const parsed = utteranceSchema.parse({
			raw: "x",
			actions: [{ intent: "DONE", matchId: "abc-123" }],
		});
		if (parsed.actions[0].intent !== "DONE") throw new Error("expected DONE");
		expect(parsed.actions[0].matchId).toBe("abc-123");
	});

	it("非法 task.place 被拒绝", () => {
		const res = utteranceSchema.safeParse({
			raw: "x",
			actions: [{ intent: "ADD", task: { text: "买菜", place: "market" } }],
		});
		expect(res.success).toBe(false);
	});

	it("dueAt 接受合法 ISO，拒绝非法字符串", () => {
		const ok = utteranceSchema.safeParse({
			raw: "x",
			actions: [
				{
					intent: "ADD",
					task: { text: "打电话", dueAt: "2026-04-23T15:00:00+08:00" },
				},
			],
		});
		expect(ok.success).toBe(true);
		const bad = utteranceSchema.safeParse({
			raw: "x",
			actions: [
				{ intent: "ADD", task: { text: "打电话", dueAt: "not-a-date" } },
			],
		});
		expect(bad.success).toBe(false);
	});

	it("STATUS 的 patch 可以单独带 status", () => {
		const parsed = utteranceSchema.parse({
			raw: "x",
			actions: [{ intent: "STATUS", patch: { status: "doing" } }],
		});
		if (parsed.actions[0].intent !== "STATUS")
			throw new Error("expected STATUS");
		expect(parsed.actions[0].patch?.status).toBe("doing");
	});
});

describe("legacyToActions", () => {
	it("单意图 ADD 包装成 actions[1]", () => {
		const legacy = legacyUtteranceSchema.parse({
			raw: "带水",
			intent: "ADD",
			aiVerb: "新增",
			aiReason: "下班路上",
			task: { text: "带水", place: "out" },
		});
		const u = legacyToActions(legacy);
		expect(u.raw).toBe("带水");
		expect(u.actions).toHaveLength(1);
		const a = u.actions[0];
		expect(a.intent).toBe("ADD");
		if (a.intent !== "ADD") throw new Error();
		expect(a.task?.text).toBe("带水");
		expect(a.task?.place).toBe("out");
		expect(a.aiVerb).toBe("新增");
	});

	it("ADD 但无 task 字段：用 raw 兜底成 task.text", () => {
		const legacy = legacyUtteranceSchema.parse({
			raw: "随便记一条",
			intent: "ADD",
		});
		const u = legacyToActions(legacy);
		if (u.actions[0].intent !== "ADD") throw new Error();
		expect(u.actions[0].task?.text).toBe("随便记一条");
	});

	it("MODIFY 带 match 和 patch", () => {
		const legacy = legacyUtteranceSchema.parse({
			raw: "改到下周一",
			intent: "MODIFY",
			match: "物业费",
			patch: { deadline: "下周一" },
		});
		const u = legacyToActions(legacy);
		if (u.actions[0].intent !== "MODIFY") throw new Error();
		expect(u.actions[0].match).toBe("物业费");
		expect(u.actions[0].patch?.deadline).toBe("下周一");
	});
});

describe("parseUtteranceFlexible", () => {
	it("新 schema 直接通过", () => {
		const u = parseUtteranceFlexible({
			raw: "带水",
			actions: [{ intent: "ADD", task: { text: "带水" } }],
		});
		expect(u.actions[0].intent).toBe("ADD");
	});

	it("老 schema 走兜底，转成 actions[]", () => {
		const u = parseUtteranceFlexible({
			raw: "带水",
			intent: "ADD",
			task: { text: "带水" },
		});
		expect(u.actions).toHaveLength(1);
		expect(u.actions[0].intent).toBe("ADD");
	});

	it("两边都不通过时抛错", () => {
		expect(() => parseUtteranceFlexible({ foo: "bar" })).toThrow();
	});
});

describe("updateTaskSchema（保险箱指针）", () => {
	it("接受合法 UUID / null / 缺省三态", () => {
		const uuid = "5c2a4d1e-9f3b-4c7d-8a6e-1b2c3d4e5f60";
		expect(updateTaskSchema.parse({ vaultKey: uuid }).vaultKey).toBe(uuid);
		expect(updateTaskSchema.parse({ vaultKey: null }).vaultKey).toBeNull();
		expect(updateTaskSchema.parse({}).vaultKey).toBeUndefined();
	});

	it("拒绝非 UUID 字符串", () => {
		expect(updateTaskSchema.safeParse({ vaultKey: "not-a-uuid" }).success).toBe(
			false,
		);
		expect(updateTaskSchema.safeParse({ vaultKey: "" }).success).toBe(false);
	});

	it("与原 PATCH 形状兼容：普通字段照常通过", () => {
		const parsed = updateTaskSchema.parse({ text: "买菜", status: "doing" });
		expect(parsed.text).toBe("买菜");
		expect(parsed.status).toBe("doing");
	});
});

describe("AI 链路写不进 vaultKey（不变量）", () => {
	const uuid = "5c2a4d1e-9f3b-4c7d-8a6e-1b2c3d4e5f60";

	it("actionSchema 的 MODIFY patch 里塞 vaultKey 会被 strip", () => {
		const action = actionSchema.parse({
			intent: "MODIFY",
			matchId: "t1",
			patch: { text: "改名", vaultKey: uuid },
		});
		if (action.intent !== "MODIFY") throw new Error("expected MODIFY");
		expect(action.patch).not.toHaveProperty("vaultKey");
	});

	it("intentConfirmSchema 的 modify patch 里塞 vaultKey 会被 strip", () => {
		const confirm = intentConfirmSchema.parse({
			kind: "modify",
			taskId: "t1",
			patch: { text: "改名", vaultKey: uuid },
		});
		if (confirm.kind !== "modify") throw new Error("expected modify");
		expect(confirm.patch).not.toHaveProperty("vaultKey");
	});
});
