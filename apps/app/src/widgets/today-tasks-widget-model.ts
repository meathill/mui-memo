import type { Bucket, TaskView } from "@mui-memo/shared/logic";
import { rerank } from "@mui-memo/shared/logic";

export type TodayTasksWidgetState = "signed-out" | "empty" | "ready";
export type TodayTasksWidgetBucket = Extract<
	Bucket,
	"doing" | "now" | "today_here" | "later"
>;

export interface TodayTasksWidgetTask {
	id: string;
	text: string;
	bucket: TodayTasksWidgetBucket;
	tags: string[];
}

export interface TodayTasksWidgetProps {
	state: TodayTasksWidgetState;
	updatedAt: string | null;
	counts: {
		total: number;
		doing: number;
		now: number;
		today: number;
		later: number;
	};
	tasks: TodayTasksWidgetTask[];
}

interface BuildTodayTasksWidgetSnapshotOptions {
	isSignedIn: boolean;
	tasks: TaskView[];
	now?: Date;
	limit?: number;
}

const DEFAULT_TASK_LIMIT = 4;
const EMPTY_COUNTS: TodayTasksWidgetProps["counts"] = {
	total: 0,
	doing: 0,
	now: 0,
	today: 0,
	later: 0,
};

export function buildTodayTasksWidgetSnapshot({
	isSignedIn,
	tasks,
	now = new Date(),
	limit = DEFAULT_TASK_LIMIT,
}: BuildTodayTasksWidgetSnapshotOptions): TodayTasksWidgetProps {
	if (!isSignedIn) {
		return {
			state: "signed-out",
			updatedAt: null,
			counts: EMPTY_COUNTS,
			tasks: [],
		};
	}

	const eligible = rerank(tasks, "any").filter(
		(task): task is TaskView & { bucket: TodayTasksWidgetBucket } =>
			isWidgetTaskBucket(task.bucket) && !task.done,
	);
	const counts = eligible.reduce<TodayTasksWidgetProps["counts"]>(
		(acc, task) => {
			acc.total += 1;
			if (task.bucket === "doing") acc.doing += 1;
			if (task.bucket === "now") acc.now += 1;
			if (task.bucket === "today_here") acc.today += 1;
			if (task.bucket === "later") acc.later += 1;
			return acc;
		},
		{ ...EMPTY_COUNTS },
	);

	return {
		state: eligible.length ? "ready" : "empty",
		updatedAt: now.toISOString(),
		counts,
		tasks: eligible.slice(0, limit).map((task) => ({
			id: task.id,
			text: task.text,
			bucket: task.bucket,
			tags: task.tags ?? [],
		})),
	};
}

function isWidgetTaskBucket(bucket: Bucket): bucket is TodayTasksWidgetBucket {
	return (
		bucket === "doing" ||
		bucket === "now" ||
		bucket === "today_here" ||
		bucket === "later"
	);
}
