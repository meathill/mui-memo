import { describe, expect, it } from "vitest";
import {
	type AdminDays,
	buildDaySeries,
	buildIntentStats,
	buildOverview,
	DEFAULT_ADMIN_DAYS,
	parseDaysParam,
	toDayKey,
} from "./admin-stats";

describe("parseDaysParam", () => {
	it("只接受 7/30/90，其余回退 30", () => {
		expect(parseDaysParam("7")).toBe(7);
		expect(parseDaysParam("30")).toBe(30);
		expect(parseDaysParam("90")).toBe(90);
		expect(parseDaysParam("14")).toBe(DEFAULT_ADMIN_DAYS);
		expect(parseDaysParam(null)).toBe(DEFAULT_ADMIN_DAYS);
		expect(parseDaysParam("abc")).toBe(DEFAULT_ADMIN_DAYS);
	});
});

describe("toDayKey / buildDaySeries", () => {
	it("按 UTC 天分桶", () => {
		expect(toDayKey(new Date("2026-09-13T16:00:00.000Z"))).toBe("2026-09-13");
	});

	it("返回含今天在内的连续 N 天（升序）", () => {
		const now = new Date("2026-09-13T10:00:00.000Z");
		const series = buildDaySeries(7, now);
		expect(series).toHaveLength(7);
		expect(series[6]).toBe("2026-09-13");
		expect(series[0]).toBe("2026-09-07");
	});
});

const NOW = new Date("2026-09-13T10:00:00.000Z");
const DAYS: AdminDays = 7;

describe("buildOverview", () => {
	it("空输入时全零且完成率为 0（不除零）", () => {
		const out = buildOverview(
			{
				users: [],
				tasks: [],
				utterances: [],
				totals: { users: 0, tasks: 0, utterances: 0 },
			},
			DAYS,
			NOW,
		);
		expect(out.totals).toEqual({
			users: 0,
			tasks: 0,
			doneTasks: 0,
			utterances: 0,
			completionRate: 0,
		});
		expect(out.series.newUsers).toHaveLength(7);
		expect(out.series.newUsers.every((d) => d.value === 0)).toBe(true);
	});

	it("新增 / 完成按天落桶，范围外被丢弃", () => {
		const out = buildOverview(
			{
				users: [{ createdAt: new Date("2026-09-13T01:00:00Z") }],
				tasks: [
					{
						createdAt: new Date("2026-09-12T01:00:00Z"),
						completedAt: new Date("2026-09-13T02:00:00Z"),
						status: "done",
						userId: "u1",
					},
					{
						createdAt: new Date("2026-01-01T00:00:00Z"),
						completedAt: null,
						status: "pending",
						userId: "u1",
					},
				],
				utterances: [
					{ createdAt: new Date("2026-09-13T03:00:00Z"), userId: "u1" },
				],
				totals: { users: 5, tasks: 10, utterances: 20 },
			},
			DAYS,
			NOW,
		);
		const byDay = (s: Array<{ day: string; value: number }>) =>
			Object.fromEntries(s.map((d) => [d.day, d.value]));
		expect(byDay(out.series.newUsers)["2026-09-13"]).toBe(1);
		expect(byDay(out.series.newTasks)["2026-09-12"]).toBe(1);
		expect(byDay(out.series.newTasks)["2026-01-01"] ?? 0).toBe(0);
		expect(byDay(out.series.doneTasks)["2026-09-13"]).toBe(1);
		expect(out.totals.completionRate).toBe(0.1);
	});

	it("活跃用户按天去重（同一人多行为只计一次）", () => {
		const out = buildOverview(
			{
				users: [],
				tasks: [
					{
						createdAt: new Date("2026-09-13T01:00:00Z"),
						completedAt: new Date("2026-09-13T05:00:00Z"),
						status: "done",
						userId: "u1",
					},
				],
				utterances: [
					{ createdAt: new Date("2026-09-13T02:00:00Z"), userId: "u1" },
					{ createdAt: new Date("2026-09-13T03:00:00Z"), userId: "u2" },
				],
				totals: { users: 2, tasks: 1, utterances: 2 },
			},
			DAYS,
			NOW,
		);
		const today = out.series.activeUsers.find((d) => d.day === "2026-09-13");
		expect(today?.value).toBe(2);
	});
});

describe("buildIntentStats", () => {
	it("空输入时全零", () => {
		const out = buildIntentStats([], DAYS, NOW);
		expect(out.total).toBe(0);
		expect(out.missRate).toBe(0);
		expect(out.byIntent).toEqual([]);
		expect(out.series).toHaveLength(7);
	});

	it("intent/effectKind 分组 + miss 率 + 日趋势", () => {
		const out = buildIntentStats(
			[
				{
					createdAt: new Date("2026-09-13T01:00:00Z"),
					intent: "ADD",
					effectKind: "add",
				},
				{
					createdAt: new Date("2026-09-13T02:00:00Z"),
					intent: "ADD",
					effectKind: "miss",
				},
				{
					createdAt: new Date("2026-09-12T01:00:00Z"),
					intent: "DONE",
					effectKind: "done",
				},
				{
					createdAt: new Date("2026-01-01T00:00:00Z"),
					intent: "ADD",
					effectKind: "add",
				},
			],
			DAYS,
			NOW,
		);
		expect(out.total).toBe(4);
		expect(out.missRate).toBe(0.25);
		expect(out.byIntent[0]).toEqual({ name: "ADD", value: 3 });
		expect(out.byEffectKind.find((e) => e.name === "miss")).toEqual({
			name: "miss",
			value: 1,
		});
		const today = out.series.find((d) => d.day === "2026-09-13");
		expect(today).toEqual({ day: "2026-09-13", total: 2, miss: 1 });
		// 范围外的行仍计入分组 totals，但不进 series
		const seriesTotal = out.series.reduce((a, d) => a + d.total, 0);
		expect(seriesTotal).toBe(3);
	});
});
