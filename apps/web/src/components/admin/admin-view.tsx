"use client";

import { useCallback, useEffect, useState } from "react";
import type { IntentStats, OverviewStats } from "@/lib/admin-stats";
import { ADMIN_DAYS_OPTIONS } from "@/lib/admin-stats";

type Tab = "overview" | "intent";

export function AdminView() {
	const [tab, setTab] = useState<Tab>("overview");
	const [days, setDays] = useState<number>(30);
	const [overview, setOverview] = useState<OverviewStats | null>(null);
	const [intent, setIntent] = useState<IntentStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError(false);
		try {
			const [oRes, iRes] = await Promise.all([
				fetch(`/api/admin/overview?days=${days}`, { cache: "no-store" }),
				fetch(`/api/admin/intent?days=${days}`, { cache: "no-store" }),
			]);
			if (!oRes.ok || !iRes.ok) throw new Error("failed");
			setOverview((await oRes.json()) as OverviewStats);
			setIntent((await iRes.json()) as IntentStats);
		} catch {
			setError(true);
		} finally {
			setLoading(false);
		}
	}, [days]);

	useEffect(() => {
		load();
	}, [load]);

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pt-6 pb-16 sm:pt-10">
			<header className="flex items-end justify-between gap-4">
				<div>
					<p className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
						叨叨记 · Admin
					</p>
					<h1 className="font-serif text-2xl text-ink">数据统计</h1>
				</div>
				<div className="flex items-center gap-1">
					{ADMIN_DAYS_OPTIONS.map((d) => (
						<button
							key={d}
							type="button"
							onClick={() => setDays(d)}
							aria-pressed={days === d}
							className={
								"rounded-lg px-3 py-1.5 font-mono text-xs transition " +
								(days === d
									? "bg-ink text-paper"
									: "text-ink-mute hover:bg-paper-2")
							}
						>
							{d}天
						</button>
					))}
				</div>
			</header>

			<nav className="mt-5 flex gap-1 border-b border-rule/60">
				<TabButton
					label="运营大盘"
					active={tab === "overview"}
					onClick={() => setTab("overview")}
				/>
				<TabButton
					label="AI 质量"
					active={tab === "intent"}
					onClick={() => setTab("intent")}
				/>
			</nav>

			{loading ? (
				<p className="mt-8 text-center text-xs text-ink-mute">加载中…</p>
			) : error ? (
				<div className="mt-8 text-center">
					<p className="text-sm text-ink">加载失败</p>
					<button
						type="button"
						onClick={load}
						className="mt-2 rounded-lg border border-rule/60 px-4 py-2 font-mono text-xs text-ink hover:bg-paper-2"
					>
						重试
					</button>
				</div>
			) : tab === "overview" && overview ? (
				<OverviewTab data={overview} />
			) : intent ? (
				<IntentTab data={intent} />
			) : null}

			<footer className="mt-10 text-center">
				<p className="font-mono text-[10px] text-ink-mute">
					仅聚合计数 · 不含任务正文与语音原话 ·
					直接读库（单表&gt;10万行再切聚合表）
				</p>
			</footer>
		</main>
	);
}

function TabButton({
	label,
	active,
	onClick,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-selected={active}
			className={
				"-mb-px border-b-2 px-4 py-2 font-serif text-sm transition " +
				(active
					? "border-ink text-ink"
					: "border-transparent text-ink-mute hover:text-ink")
			}
		>
			{label}
		</button>
	);
}

function OverviewTab({ data }: { data: OverviewStats }) {
	const t = data.totals;
	return (
		<div>
			<section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<StatCard label="用户总数" value={t.users} />
				<StatCard label="任务总数" value={t.tasks} />
				<StatCard
					label="累计完成率"
					value={`${Math.round(t.completionRate * 1000) / 10}%`}
				/>
				<StatCard label="语音条数" value={t.utterances} />
			</section>
			<TrendSection title="新增用户" series={data.series.newUsers} />
			<TrendSection title="新增任务" series={data.series.newTasks} />
			<TrendSection title="完成任务" series={data.series.doneTasks} />
			<TrendSection title="语音条数" series={data.series.utterances} />
			<TrendSection
				title="活跃用户（有行为去重）"
				series={data.series.activeUsers}
			/>
		</div>
	);
}

function IntentTab({ data }: { data: IntentStats }) {
	return (
		<div>
			<section className="mt-5 grid grid-cols-2 gap-3">
				<StatCard label="语音总数" value={data.total} />
				<StatCard
					label="miss 率"
					value={`${Math.round(data.missRate * 1000) / 10}%`}
					accent={data.missRate > 0.15}
				/>
			</section>
			<DistSection title="intent 分布" items={data.byIntent} />
			<DistSection title="effectKind 分布" items={data.byEffectKind} />
			<section className="mt-6 rounded-2xl border border-rule/60 bg-paper-2/50 p-5">
				<SectionTitle title="日趋势（总量 / miss）" />
				<div className="mt-3 space-y-1.5">
					{data.series.map((d) => (
						<BarRow
							key={d.day}
							label={d.day.slice(5)}
							value={d.total}
							max={Math.max(...data.series.map((x) => x.total), 1)}
							hint={d.miss > 0 ? `miss ${d.miss}` : undefined}
							warn={d.total > 0 && d.miss / d.total > 0.3}
						/>
					))}
				</div>
			</section>
		</div>
	);
}

function StatCard({
	label,
	value,
	accent,
}: {
	label: string;
	value: number | string;
	accent?: boolean;
}) {
	return (
		<div
			className={
				"rounded-2xl border p-4 " +
				(accent
					? "border-accent-warm/40 bg-accent-warm/10"
					: "border-rule/60 bg-paper-2/50")
			}
		>
			<p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-mute">
				{label}
			</p>
			<p className="mt-1 font-serif text-3xl text-ink">{value}</p>
		</div>
	);
}

function SectionTitle({ title }: { title: string }) {
	return (
		<h2 className="font-mono text-[10px] tracking-[0.15em] text-ink-mute uppercase">
			{title}
		</h2>
	);
}

function TrendSection({
	title,
	series,
}: {
	title: string;
	series: Array<{ day: string; value: number }>;
}) {
	return (
		<section className="mt-6 rounded-2xl border border-rule/60 bg-paper-2/50 p-5">
			<SectionTitle title={title} />
			<div className="mt-3 space-y-1.5">
				{series.map((d) => (
					<BarRow
						key={d.day}
						label={d.day.slice(5)}
						value={d.value}
						max={Math.max(...series.map((x) => x.value), 1)}
					/>
				))}
			</div>
		</section>
	);
}

function DistSection({
	title,
	items,
}: {
	title: string;
	items: Array<{ name: string; value: number }>;
}) {
	const total = items.reduce((a, b) => a + b.value, 0);
	return (
		<section className="mt-6 rounded-2xl border border-rule/60 bg-paper-2/50 p-5">
			<SectionTitle title={title} />
			<div className="mt-3 space-y-1.5">
				{items.length === 0 ? (
					<p className="text-xs text-ink-mute">暂无数据</p>
				) : (
					items.map((item) => (
						<BarRow
							key={item.name}
							label={item.name}
							value={item.value}
							max={Math.max(total, 1)}
							hint={`${total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0}%`}
							warn={item.name === "miss"}
						/>
					))
				)}
			</div>
		</section>
	);
}

function BarRow({
	label,
	value,
	max,
	hint,
	warn,
}: {
	label: string;
	value: number;
	max: number;
	hint?: string;
	warn?: boolean;
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="w-14 shrink-0 font-mono text-[10px] text-ink-mute">
				{label}
			</span>
			<div className="h-4 flex-1 overflow-hidden rounded bg-rule/30">
				<div
					className={
						"h-full rounded transition-all " +
						(warn ? "bg-accent-warm/70" : "bg-ink/60")
					}
					style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
				/>
			</div>
			<span className="w-16 shrink-0 text-right font-mono text-[10px] text-ink">
				{value}
				{hint ? <span className="text-ink-mute"> {hint}</span> : null}
			</span>
		</div>
	);
}
