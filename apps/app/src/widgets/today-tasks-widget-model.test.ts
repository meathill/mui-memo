import type { TaskView } from "@mui-memo/shared/logic";
import { describe, expect, it } from "vitest";
import { buildTodayTasksWidgetSnapshot } from "./today-tasks-widget-model";

const NOW = new Date("2026-06-24T06:30:00.000Z");

function task(
	overrides: Partial<TaskView> & { id: string; text?: string },
): TaskView {
	const { id, text, ...rest } = overrides;
	return {
		id,
		text: text ?? `任务 ${id}`,
		place: "any",
		window: "today",
		energy: 2,
		priority: 2,
		tags: [],
		status: "pending",
		done: false,
		...rest,
	};
}

describe("今日任务 widget snapshot", () => {
	it("未登录时返回 signed-out 且不暴露任务", () => {
		const snapshot = buildTodayTasksWidgetSnapshot({
			isSignedIn: false,
			tasks: [task({ id: "a" })],
			now: NOW,
		});

		expect(snapshot).toEqual({
			state: "signed-out",
			updatedAt: null,
			counts: { total: 0, doing: 0, now: 0, today: 0, later: 0 },
			tasks: [],
		});
	});

	it("已登录但没有可展示任务时返回 empty", () => {
		const snapshot = buildTodayTasksWidgetSnapshot({
			isSignedIn: true,
			tasks: [],
			now: NOW,
		});

		expect(snapshot.state).toBe("empty");
		expect(snapshot.updatedAt).toBe("2026-06-24T06:30:00.000Z");
		expect(snapshot.counts.total).toBe(0);
		expect(snapshot.tasks).toEqual([]);
	});

	it("过滤普通已完成任务和 linked 子任务", () => {
		const snapshot = buildTodayTasksWidgetSnapshot({
			isSignedIn: true,
			tasks: [
				task({
					id: "done",
					status: "done",
					done: true,
					completedAt: NOW.toISOString(),
				}),
				task({ id: "linked", status: "linked" }),
				task({ id: "open", window: "now" }),
			],
			now: NOW,
		});

		expect(snapshot.state).toBe("ready");
		expect(snapshot.counts).toEqual({
			total: 1,
			doing: 0,
			now: 1,
			today: 0,
			later: 0,
		});
		expect(snapshot.tasks.map((item) => item.id)).toEqual(["open"]);
	});

	it("按 rerank 顺序输出并保留最多 4 条", () => {
		const snapshot = buildTodayTasksWidgetSnapshot({
			isSignedIn: true,
			tasks: [
				task({ id: "later-high", window: "later", priority: 5 }),
				task({ id: "now-low", window: "now", priority: 1 }),
				task({ id: "today-mid", window: "today", priority: 3 }),
				task({ id: "doing", status: "doing", window: "now", priority: 1 }),
				task({ id: "now-high", window: "now", priority: 5, tags: ["报销"] }),
				task({ id: "today-low", window: "today", priority: 1 }),
			],
			now: NOW,
		});

		expect(snapshot.counts).toEqual({
			total: 6,
			doing: 1,
			now: 2,
			today: 2,
			later: 1,
		});
		expect(snapshot.tasks).toEqual([
			{ id: "doing", text: "任务 doing", bucket: "doing", tags: [] },
			{ id: "now-high", text: "任务 now-high", bucket: "now", tags: ["报销"] },
			{ id: "now-low", text: "任务 now-low", bucket: "now", tags: [] },
			{
				id: "today-mid",
				text: "任务 today-mid",
				bucket: "today_here",
				tags: [],
			},
		]);
	});

	it("可通过 limit 覆盖输出条数", () => {
		const snapshot = buildTodayTasksWidgetSnapshot({
			isSignedIn: true,
			tasks: [task({ id: "a" }), task({ id: "b" })],
			now: NOW,
			limit: 1,
		});

		expect(snapshot.counts.total).toBe(2);
		expect(snapshot.tasks.map((item) => item.id)).toEqual(["a"]);
	});
});
