import type { CompletedTask } from "@mui-memo/shared/dto";
import type { TaskView } from "@mui-memo/shared/logic";
import type { TaskStatus, TaskWindow } from "@mui-memo/shared/validators";
import type { TaskPatch } from "@/lib/api";
import { TASKS_REFRESH_TTL_MS } from "@/lib/task-sync-constants";

export const APP_STATE_STORAGE_KEY = "mui-memo.app-state";

export type LocalTaskPatch = Partial<
	Pick<
		TaskView,
		| "text"
		| "place"
		| "energy"
		| "priority"
		| "tags"
		| "deadline"
		| "expectAt"
		| "dueAt"
	>
> & {
	window?: TaskWindow;
	status?: TaskStatus;
	completedAt?: string | null;
	/** 保险箱指针。只是无意义 UUID，随视图缓存无害；明文不进本模块。 */
	vaultKey?: string | null;
};

interface PersistedAppState {
	state?: {
		tasks?: unknown;
	};
}

export function extractLegacyTasksFromPersistedState(
	value: string | null,
): TaskView[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as PersistedAppState;
		return Array.isArray(parsed.state?.tasks)
			? parsed.state.tasks.filter(isTaskViewLike)
			: [];
	} catch {
		return [];
	}
}

export function stripLegacyTasksFromPersistedState(
	value: string | null,
): string | null {
	if (!value) return value;
	try {
		const parsed = JSON.parse(value) as PersistedAppState;
		if (parsed.state && "tasks" in parsed.state) {
			delete parsed.state.tasks;
			return JSON.stringify(parsed);
		}
	} catch {
		return value;
	}
	return value;
}

export function collectLocalTagCandidates(
	tasks: TaskView[],
	limit = 100,
): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const task of tasks) {
		for (const tag of task.tags ?? []) {
			const normalized = tag.trim();
			if (!normalized || seen.has(normalized)) continue;
			seen.add(normalized);
			out.push(normalized);
			if (out.length >= limit) return out;
		}
	}
	return out;
}

export function mergeTaskPatch(
	task: TaskView,
	patch: LocalTaskPatch,
	now = new Date(),
): TaskView {
	const next: TaskView = { ...task };
	if (patch.text !== undefined) next.text = patch.text;
	if (patch.place !== undefined) next.place = patch.place;
	if (patch.window !== undefined) next.window = patch.window;
	if (patch.energy !== undefined) next.energy = patch.energy;
	if (patch.priority !== undefined) next.priority = patch.priority;
	if (patch.tags !== undefined) next.tags = patch.tags;
	if (patch.deadline !== undefined) next.deadline = patch.deadline;
	if (patch.expectAt !== undefined) next.expectAt = patch.expectAt;
	if (patch.dueAt !== undefined) next.dueAt = patch.dueAt;
	if (patch.vaultKey !== undefined) next.vaultKey = patch.vaultKey;
	if (patch.status !== undefined) {
		next.status = patch.status;
		next.done = patch.status === "done";
		next.completedAt =
			patch.status === "done"
				? (patch.completedAt ?? next.completedAt ?? now.toISOString())
				: null;
	} else if (patch.completedAt !== undefined) {
		next.completedAt = patch.completedAt;
	}
	return next;
}

export function taskPatchToLocalPatch(
	patch: Partial<TaskPatch>,
): LocalTaskPatch {
	const out: LocalTaskPatch = {};
	if (patch.text !== undefined) out.text = patch.text;
	if (patch.place !== undefined) out.place = patch.place;
	if (patch.window !== undefined) out.window = patch.window;
	if (patch.energy !== undefined) out.energy = patch.energy;
	if (patch.priority !== undefined) out.priority = patch.priority;
	if (patch.tags !== undefined) out.tags = patch.tags;
	if (patch.deadline !== undefined) out.deadline = patch.deadline;
	if (patch.expectAt !== undefined) out.expectAt = patch.expectAt;
	if (patch.dueAt !== undefined) out.dueAt = patch.dueAt;
	if (patch.status !== undefined) out.status = patch.status;
	if (patch.vaultKey !== undefined) out.vaultKey = patch.vaultKey;
	return out;
}

export function completedTaskToView(task: CompletedTask): TaskView {
	return {
		id: task.id,
		text: task.text,
		place: "any",
		window: "today",
		energy: 2,
		priority: 2,
		tags: task.tags,
		status: "done",
		done: true,
		completedAt: task.completedAt,
	};
}

export function shouldRefreshTasks(args: {
	force?: boolean;
	tasksLength: number;
	lastTasksSyncedAt: number | null;
	now: number;
	ttlMs?: number;
}): boolean {
	if (args.force) return true;
	if (args.tasksLength <= 0) return true;
	if (!args.lastTasksSyncedAt) return true;
	return (
		args.now - args.lastTasksSyncedAt >= (args.ttlMs ?? TASKS_REFRESH_TTL_MS)
	);
}

export function shouldClearTaskSnapshotForUserChange(args: {
	previousUserId?: string | null;
	nextUserId: string;
	didResetLocalCache: boolean;
}): boolean {
	if (args.didResetLocalCache) return true;
	return Boolean(
		args.previousUserId && args.previousUserId !== args.nextUserId,
	);
}

function isTaskViewLike(value: unknown): value is TaskView {
	if (!value || typeof value !== "object") return false;
	const task = value as Partial<TaskView>;
	return (
		typeof task.id === "string" &&
		typeof task.text === "string" &&
		typeof task.place === "string" &&
		typeof task.window === "string" &&
		typeof task.status === "string" &&
		typeof task.done === "boolean"
	);
}
