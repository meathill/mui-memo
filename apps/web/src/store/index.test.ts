import type { IntentEffect } from "@mui-memo/shared/logic";
import type { Utterance } from "@mui-memo/shared/validators";
import { beforeEach, describe, expect, it } from "vitest";
import { type PendingConfirm, useAppStore } from "./index";

const utterance: Utterance = {
	raw: "明天交报告",
	actions: [
		{ intent: "ADD", aiReason: "", aiVerb: "", task: { text: "明天交报告" } },
	],
	dims: [],
};

const effect: IntentEffect = {
	kind: "done",
	id: "t-1",
	text: "交报告",
	verb: "完成",
	reason: "用户说做完了",
};

function makeConfirm(index: number): PendingConfirm {
	return { index, effect, utterance };
}

beforeEach(() => {
	useAppStore.setState({
		place: "any",
		tasks: [],
		ranked: [],
		lastEffects: [],
		lastUtterance: null,
		pendingConfirms: [],
		isProcessing: false,
		isRecording: false,
	});
});

describe("useAppStore", () => {
	it("初始态为空", () => {
		const s = useAppStore.getState();
		expect(s.place).toBe("any");
		expect(s.pendingConfirms).toEqual([]);
		expect(s.isProcessing).toBe(false);
	});

	it("hydrate 替换任务并保留 place（未传时）", () => {
		useAppStore.getState().setPlace("home");
		useAppStore.getState().hydrate({ tasks: [], ranked: [] });
		expect(useAppStore.getState().place).toBe("home");
		useAppStore.getState().hydrate({ tasks: [], ranked: [], place: "work" });
		expect(useAppStore.getState().place).toBe("work");
	});

	it("待确认队列先进先出", () => {
		const { pushPendingConfirms, shiftPendingConfirm } = useAppStore.getState();
		pushPendingConfirms([makeConfirm(0), makeConfirm(1)]);
		expect(useAppStore.getState().pendingConfirms).toHaveLength(2);
		shiftPendingConfirm();
		const rest = useAppStore.getState().pendingConfirms;
		expect(rest).toHaveLength(1);
		expect(rest[0]?.index).toBe(1);
		useAppStore.getState().clearPendingConfirms();
		expect(useAppStore.getState().pendingConfirms).toEqual([]);
	});

	it("setLastEffects 缺省 utterance 置空", () => {
		useAppStore.getState().setLastEffects([effect]);
		const s = useAppStore.getState();
		expect(s.lastEffects).toHaveLength(1);
		expect(s.lastUtterance).toBeNull();
		useAppStore.getState().setLastEffects([effect], utterance);
		expect(useAppStore.getState().lastUtterance?.raw).toBe("明天交报告");
	});

	it("录音与处理中开关独立", () => {
		useAppStore.getState().setRecording(true);
		useAppStore.getState().setProcessing(true);
		const s = useAppStore.getState();
		expect(s.isRecording).toBe(true);
		expect(s.isProcessing).toBe(true);
	});
});
