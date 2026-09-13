"use client";

import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { OverviewStats } from "@/lib/admin-stats";
import { ChartCard, StatCard } from "./admin-ui";
import { TOOLTIP_STYLE, useChartTheme } from "./chart-theme";

const TRENDS: Array<{
	key: "newUsers" | "newTasks" | "doneTasks" | "utterances" | "activeUsers";
	title: string;
}> = [
	{ key: "newUsers", title: "新增用户" },
	{ key: "newTasks", title: "新增任务" },
	{ key: "doneTasks", title: "完成任务" },
	{ key: "utterances", title: "语音条数" },
	{ key: "activeUsers", title: "活跃用户（有行为去重）" },
];

export function OverviewTab({ data }: { data: OverviewStats }) {
	const t = data.totals;
	return (
		<div>
			<section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
				<StatCard label="用户总数" value={t.users} />
				<StatCard label="任务总数" value={t.tasks} />
				<StatCard
					label="累计完成率"
					value={`${Math.round(t.completionRate * 1000) / 10}%`}
				/>
				<StatCard label="语音条数" value={t.utterances} />
			</section>
			<div className="mt-4 grid gap-4 lg:grid-cols-2">
				{TRENDS.map((trend, i) => (
					<TrendChart
						key={trend.key}
						title={trend.title}
						series={data.series[trend.key]}
						colorIndex={i}
						wide={i === TRENDS.length - 1}
					/>
				))}
			</div>
		</div>
	);
}

function TrendChart({
	title,
	series,
	colorIndex,
	wide,
}: {
	title: string;
	series: Array<{ day: string; value: number }>;
	colorIndex: number;
	wide?: boolean;
}) {
	const theme = useChartTheme();
	const color = theme.charts[colorIndex % theme.charts.length];
	const data = series.map((d) => ({ ...d, label: d.day.slice(5) }));
	return (
		<ChartCard title={title} wide={wide}>
			<div className="h-52">
				<ResponsiveContainer width="100%" height="100%">
					<AreaChart
						data={data}
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
						<Area
							type="monotone"
							dataKey="value"
							name={title}
							stroke={color}
							strokeWidth={2}
							fill={color}
							fillOpacity={0.22}
							isAnimationActive={false}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</div>
		</ChartCard>
	);
}
