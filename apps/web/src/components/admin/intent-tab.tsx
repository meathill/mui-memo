"use client";

import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ComposedChart,
	Legend,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { IntentStats } from "@/lib/admin-stats";
import { ChartCard, StatCard } from "./admin-ui";
import { TOOLTIP_STYLE, useChartTheme } from "./chart-theme";

export function IntentTab({ data }: { data: IntentStats }) {
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
			<div className="mt-4 grid gap-4 lg:grid-cols-2">
				<DistChart title="intent 分布" items={data.byIntent} colorIndex={1} />
				<DistChart
					title="effectKind 分布"
					items={data.byEffectKind}
					colorIndex={0}
					warnName="miss"
				/>
			</div>
			<div className="mt-4">
				<ChartCard title="日趋势（总量 / miss）" wide>
					<MissTrendChart data={data} />
				</ChartCard>
			</div>
		</div>
	);
}

function DistChart({
	title,
	items,
	colorIndex,
	warnName,
}: {
	title: string;
	items: Array<{ name: string; value: number }>;
	colorIndex: number;
	warnName?: string;
}) {
	const theme = useChartTheme();
	const total = items.reduce((a, b) => a + b.value, 0);
	const color = theme.charts[colorIndex % theme.charts.length];
	const warn = theme.charts[4 % theme.charts.length];
	return (
		<ChartCard title={title}>
			{items.length === 0 ? (
				<p className="py-8 text-center text-xs text-ink-mute">暂无数据</p>
			) : (
				<div style={{ height: Math.max(items.length * 40 + 16, 120) }}>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={items}
							layout="vertical"
							margin={{ left: 8, right: 48 }}
						>
							<XAxis type="number" hide />
							<YAxis
								type="category"
								dataKey="name"
								width={72}
								tickLine={false}
								axisLine={false}
								tick={{ fill: theme.mute, fontSize: 11 }}
							/>
							<Tooltip
								contentStyle={TOOLTIP_STYLE}
								formatter={(value) => {
									const v = Number(value);
									const pct =
										total > 0
											? `${Math.round((v / total) * 1000) / 10}%`
											: "0%";
									return [`${v}（${pct}）`, "数量"];
								}}
							/>
							<Bar
								dataKey="value"
								radius={[0, 6, 6, 0]}
								barSize={18}
								isAnimationActive={false}
							>
								{items.map((item) => (
									<Cell
										key={item.name}
										fill={item.name === warnName ? warn : color}
									/>
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}
		</ChartCard>
	);
}

function MissTrendChart({ data }: { data: IntentStats }) {
	const theme = useChartTheme();
	const rows = data.series.map((d) => ({ ...d, label: d.day.slice(5) }));
	return (
		<div className="h-60">
			<ResponsiveContainer width="100%" height="100%">
				<ComposedChart
					data={rows}
					margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
				>
					<CartesianGrid
						stroke={theme.rule}
						strokeDasharray="3 3"
						vertical={false}
					/>
					<XAxis
						dataKey="label"
						tickLine={false}
						axisLine={{ stroke: theme.rule }}
						tick={{ fill: theme.mute, fontSize: 10 }}
						interval="preserveStartEnd"
						minTickGap={28}
					/>
					<YAxis
						allowDecimals={false}
						tickLine={false}
						axisLine={false}
						tick={{ fill: theme.mute, fontSize: 10 }}
						width={36}
					/>
					<Tooltip
						contentStyle={TOOLTIP_STYLE}
						labelFormatter={(_, payload) => payload?.[0]?.payload?.day ?? ""}
					/>
					<Legend wrapperStyle={{ fontSize: 12 }} />
					<Bar
						dataKey="total"
						name="语音总数"
						fill={theme.charts[0]}
						fillOpacity={0.75}
						radius={[4, 4, 0, 0]}
						barSize={14}
						isAnimationActive={false}
					/>
					<Line
						type="monotone"
						dataKey="miss"
						name="miss"
						stroke={theme.charts[4]}
						strokeWidth={2}
						dot={false}
						isAnimationActive={false}
					/>
				</ComposedChart>
			</ResponsiveContainer>
		</div>
	);
}
