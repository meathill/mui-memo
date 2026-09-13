/**
 * Admin 数据统计聚合纯函数（对应 /admin 两 tab）。
 *
 * 设计取舍：行拉回 TS 侧按 UTC 天分桶，而不是 SQL `GROUP BY DATE()`。
 * 理由：单表万行内传输成本可忽略；换来口径可单测 + 不受 DB 会话时区漂移影响。
 * 切日粒度聚合表的阈值：单表 >10 万行，或 admin 接口 p95 >2s（届时另起任务）。
 */

export const ADMIN_DAYS_OPTIONS = [7, 30, 90] as const;
export type AdminDays = (typeof ADMIN_DAYS_OPTIONS)[number];
export const DEFAULT_ADMIN_DAYS: AdminDays = 30;

export function parseDaysParam(value: unknown): AdminDays {
	const n = typeof value === "string" ? Number(value) : Number.NaN;
	return (ADMIN_DAYS_OPTIONS as readonly number[]).includes(n)
		? (n as AdminDays)
		: DEFAULT_ADMIN_DAYS;
}

/** UTC 天粒度的桶 key：`YYYY-MM-DD`。 */
export function toDayKey(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** 含今天在内的连续 N 天（升序）。 */
export function buildDaySeries(
	days: AdminDays,
	now: Date = new Date(),
): string[] {
	const out: string[] = [];
	const base = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate(),
	);
	for (let i = days - 1; i >= 0; i--) {
		out.push(new Date(base - i * 86_400_000).toISOString().slice(0, 10));
	}
	return out;
}

function zeroSeries(days: string[]): Array<{ day: string; value: number }> {
	return days.map((day) => ({ day, value: 0 }));
}

// ── Tab 1 运营大盘 ──────────────────────────────────────────────

export interface OverviewUserRow {
	createdAt: Date;
}

export interface OverviewTaskRow {
	createdAt: Date;
	completedAt: Date | null;
	status: string;
	userId: string;
}

export interface OverviewUtteranceRow {
	createdAt: Date;
	userId: string;
}

export interface OverviewStats {
	days: AdminDays;
	totals: {
		users: number;
		tasks: number;
		doneTasks: number;
		utterances: number;
		/** doneTasks / tasks，全站累计完成率（tasks=0 时为 0）。 */
		completionRate: number;
	};
	series: {
		newUsers: Array<{ day: string; value: number }>;
		newTasks: Array<{ day: string; value: number }>;
		doneTasks: Array<{ day: string; value: number }>;
		utterances: Array<{ day: string; value: number }>;
		/**
		 * 活跃用户（近似 DAU）：当天有「建任务 / 完成任务 / 发语音」
		 * 任一行为的去重用户数。以行为为准，不是登录数。
		 */
		activeUsers: Array<{ day: string; value: number }>;
	};
}

export function buildOverview(
	args: {
		users: OverviewUserRow[];
		tasks: OverviewTaskRow[];
		utterances: OverviewUtteranceRow[];
		totals: { users: number; tasks: number; utterances: number };
	},
	days: AdminDays,
	now: Date = new Date(),
): OverviewStats {
	const dayList = buildDaySeries(days, now);
	const newUsers = zeroSeries(dayList);
	const newTasks = zeroSeries(dayList);
	const doneTasks = zeroSeries(dayList);
	const utteranceCounts = zeroSeries(dayList);
	const activeUsers = zeroSeries(dayList);
	const index = new Map(dayList.map((d, i) => [d, i]));
	const activeSets: Array<Set<string>> = dayList.map(() => new Set());

	function bump(
		series: Array<{ day: string; value: number }>,
		d: Date,
		userId?: string,
	) {
		const i = index.get(toDayKey(d));
		if (i === undefined) return;
		series[i].value += 1;
		if (userId) {
			activeSets[i].add(userId);
			activeUsers[i].value = activeSets[i].size;
		}
	}

	for (const u of args.users) bump(newUsers, u.createdAt);
	for (const t of args.tasks) {
		bump(newTasks, t.createdAt, t.userId);
		if (t.status === "done" && t.completedAt) {
			const i = index.get(toDayKey(t.completedAt));
			if (i !== undefined) {
				doneTasks[i].value += 1;
				activeSets[i].add(t.userId);
				activeUsers[i].value = activeSets[i].size;
			}
		}
	}
	for (const u of args.utterances) bump(utteranceCounts, u.createdAt, u.userId);

	const doneTotal = args.tasks.filter((t) => t.status === "done").length;
	return {
		days,
		totals: {
			users: args.totals.users,
			tasks: args.totals.tasks,
			doneTasks: doneTotal,
			utterances: args.totals.utterances,
			completionRate:
				args.totals.tasks > 0
					? Math.round((doneTotal / args.totals.tasks) * 10_000) / 10_000
					: 0,
		},
		series: {
			newUsers,
			newTasks,
			doneTasks,
			utterances: utteranceCounts,
			activeUsers,
		},
	};
}

// ── Tab 2 AI 质量 ───────────────────────────────────────────────

export interface IntentUtteranceRow {
	createdAt: Date;
	intent: string;
	effectKind: string;
}

export interface IntentStats {
	days: AdminDays;
	total: number;
	/** effectKind='miss' / total（total=0 时为 0）。 */
	missRate: number;
	byIntent: Array<{ name: string; value: number }>;
	byEffectKind: Array<{ name: string; value: number }>;
	series: Array<{ day: string; total: number; miss: number }>;
}

export function buildIntentStats(
	utterances: IntentUtteranceRow[],
	days: AdminDays,
	now: Date = new Date(),
): IntentStats {
	const dayList = buildDaySeries(days, now);
	const index = new Map(dayList.map((d, i) => [d, i]));
	const series = dayList.map((day) => ({ day, total: 0, miss: 0 }));
	const byIntent = new Map<string, number>();
	const byEffectKind = new Map<string, number>();
	let miss = 0;

	for (const u of utterances) {
		byIntent.set(u.intent, (byIntent.get(u.intent) ?? 0) + 1);
		byEffectKind.set(u.effectKind, (byEffectKind.get(u.effectKind) ?? 0) + 1);
		if (u.effectKind === "miss") miss += 1;
		const i = index.get(toDayKey(u.createdAt));
		if (i === undefined) continue;
		series[i].total += 1;
		if (u.effectKind === "miss") series[i].miss += 1;
	}

	const sortDesc = (m: Map<string, number>) =>
		[...m.entries()]
			.map(([name, value]) => ({ name, value }))
			.sort((a, b) => b.value - a.value);

	return {
		days,
		total: utterances.length,
		missRate:
			utterances.length > 0
				? Math.round((miss / utterances.length) * 10_000) / 10_000
				: 0,
		byIntent: sortDesc(byIntent),
		byEffectKind: sortDesc(byEffectKind),
		series,
	};
}
