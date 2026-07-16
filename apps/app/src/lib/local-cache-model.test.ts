import type { TaskView } from "@mui-memo/shared/logic";
import { describe, expect, it } from "vitest";
import {
	collectLocalTagCandidates,
	completedTaskToView,
	extractLegacyTasksFromPersistedState,
	mergeTaskPatch,
	shouldClearTaskSnapshotForUserChange,
	shouldRefreshTasks,
	stripLegacyTasksFromPersistedState,
	taskPatchToLocalPatch,
} from "./local-cache-model";

function task(overrides: Partial<TaskView> & { id?: string } = {}): TaskView {
	return {
		id: "t1",
		text: "买牛奶",
		place: "home",
		window: "today",
		energy: 2,
		priority: 2,
		status: "pending",
		done: false,
		...overrides,
	};
}

describe("legacy AsyncStorage 任务迁移解析", () => {
	it("从 zustand persist JSON 里取出旧 tasks", () => {
		const stored = JSON.stringify({
			state: {
				theme: "paper",
				tasks: [task({ id: "a" }), task({ id: "b", text: "交物业费" })],
			},
			version: 0,
		});
		expect(
			extractLegacyTasksFromPersistedState(stored).map((item) => item.id),
		).toEqual(["a", "b"]);
	});

	it("坏 JSON、缺 tasks、非法 task 都安全返回空数组或过滤掉", () => {
		expect(extractLegacyTasksFromPersistedState("{")).toEqual([]);
		expect(
			extractLegacyTasksFromPersistedState(
				JSON.stringify({ state: { theme: "paper" } }),
			),
		).toEqual([]);
		expect(
			extractLegacyTasksFromPersistedState(
				JSON.stringify({ state: { tasks: [{ id: "x" }, task({ id: "ok" })] } }),
			),
		).toEqual([task({ id: "ok" })]);
	});

	it("stripLegacyTasksFromPersistedState 只删除 tasks，保留其它轻量状态", () => {
		const stored = JSON.stringify({
			state: {
				theme: "night",
				queue: [{ id: "q1" }],
				barChips: [{ kind: "place", place: "home" }],
				tasks: [task()],
			},
			version: 0,
		});
		const stripped = stripLegacyTasksFromPersistedState(stored);
		expect(stripped).toBeTruthy();
		const parsed = JSON.parse(stripped ?? "{}") as {
			state: Record<string, unknown>;
		};
		expect(parsed.state.tasks).toBeUndefined();
		expect(parsed.state.theme).toBe("night");
		expect(parsed.state.queue).toEqual([{ id: "q1" }]);
	});
});

describe("本地标签候选", () => {
	it("按本地任务顺序收集标签、trim、去重", () => {
		const tags = collectLocalTagCandidates([
			task({ tags: [" 网银 ", "报销"] }),
			task({ id: "t2", tags: ["网银", "采购"] }),
			task({ id: "t3", tags: [""] }),
		]);
		expect(tags).toEqual(["网银", "报销", "采购"]);
	});

	it("最多收集 limit 个", () => {
		const tasks = Array.from({ length: 105 }, (_, i) =>
			task({ id: `t${i}`, tags: [`标签${i}`] }),
		);
		expect(collectLocalTagCandidates(tasks, 100)).toHaveLength(100);
		expect(collectLocalTagCandidates(tasks, 100).at(-1)).toBe("标签99");
	});
});

describe("本地任务 patch", () => {
	it("done patch 会设置 done=true 和 completedAt", () => {
		const next = mergeTaskPatch(
			task(),
			{ status: "done" },
			new Date("2026-06-24T04:00:00.000Z"),
		);
		expect(next.status).toBe("done");
		expect(next.done).toBe(true);
		expect(next.completedAt).toBe("2026-06-24T04:00:00.000Z");
	});

	it("pending patch 会清 completedAt", () => {
		const next = mergeTaskPatch(
			task({
				status: "done",
				done: true,
				completedAt: "2026-06-24T04:00:00.000Z",
			}),
			{
				status: "pending",
			},
		);
		expect(next.status).toBe("pending");
		expect(next.done).toBe(false);
		expect(next.completedAt).toBeNull();
	});

	it("taskPatchToLocalPatch 保留显式 null，用于清空时间字段", () => {
		expect(
			taskPatchToLocalPatch({ expectAt: null, dueAt: null, tags: [] }),
		).toEqual({
			expectAt: null,
			dueAt: null,
			tags: [],
		});
	});

	it("completedTaskToView 生成可回滚的任务视图", () => {
		expect(
			completedTaskToView({
				id: "c1",
				text: "交物业费",
				tags: ["财务"],
				completedAt: "2026-06-24T04:00:00Z",
			}),
		).toMatchObject({
			id: "c1",
			status: "done",
			done: true,
			tags: ["财务"],
		});
	});
});

describe("刷新 TTL", () => {
	it("强制刷新、空任务、无同步时间都会刷新", () => {
		expect(
			shouldRefreshTasks({
				force: true,
				tasksLength: 10,
				lastTasksSyncedAt: 1,
				now: 2,
			}),
		).toBe(true);
		expect(
			shouldRefreshTasks({ tasksLength: 0, lastTasksSyncedAt: 1, now: 2 }),
		).toBe(true);
		expect(
			shouldRefreshTasks({ tasksLength: 10, lastTasksSyncedAt: null, now: 2 }),
		).toBe(true);
	});

	it("有缓存且未超过 TTL 时不刷新，超过 TTL 时刷新", () => {
		expect(
			shouldRefreshTasks({
				tasksLength: 10,
				lastTasksSyncedAt: 1_000,
				now: 30_000,
				ttlMs: 60_000,
			}),
		).toBe(false);
		expect(
			shouldRefreshTasks({
				tasksLength: 10,
				lastTasksSyncedAt: 1_000,
				now: 61_000,
				ttlMs: 60_000,
			}),
		).toBe(true);
	});
});

describe("账号切换快照清理", () => {
	it("同一用户且本地库未重置时保留内存快照", () => {
		expect(
			shouldClearTaskSnapshotForUserChange({
				previousUserId: "u1",
				nextUserId: "u1",
				didResetLocalCache: false,
			}),
		).toBe(false);
	});

	it("用户变化时清掉内存快照", () => {
		expect(
			shouldClearTaskSnapshotForUserChange({
				previousUserId: "u1",
				nextUserId: "u2",
				didResetLocalCache: false,
			}),
		).toBe(true);
	});

	it("SQLite 因用户变化清库时也清掉内存快照", () => {
		expect(
			shouldClearTaskSnapshotForUserChange({
				previousUserId: null,
				nextUserId: "u2",
				didResetLocalCache: true,
			}),
		).toBe(true);
	});
});
