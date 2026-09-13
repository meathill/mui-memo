"use client";

import { useCallback, useEffect, useState } from "react";
import type { IntentStats, OverviewStats } from "@/lib/admin-stats";
import { ADMIN_DAYS_OPTIONS } from "@/lib/admin-stats";
import { IntentTab } from "./intent-tab";
import { OverviewTab } from "./overview-tab";

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
		<main className="container mx-auto px-4 pt-6 pb-16 sm:pt-10">
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
