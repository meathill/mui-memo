"use client";

import { useEffect, useState } from "react";

/**
 * 从 CSS 变量里读图表配色（--chart-1..5 / --ink / --ink-mute / --rule），
 * 跟 paper / night / mono 主题走。
 *
 * 为什么不用 `stroke="var(--chart-1)"`：recharts 把颜色写进 SVG 属性，
 * presentation attribute 不解析 var()，必须传解析后的具体值。
 * 首渲染用 paper 主题近似值兜底（SSR 无 document），挂载后校准一次。
 */
export interface ChartTheme {
	charts: string[];
	ink: string;
	mute: string;
	rule: string;
}

const FALLBACK: ChartTheme = {
	charts: ["#ea580c", "#0d9488", "#164e63", "#fbbf24", "#f59e0b"],
	ink: "#1d1a12",
	mute: "#8a8272",
	rule: "#e2d9c6",
};

export function useChartTheme(): ChartTheme {
	const [theme, setTheme] = useState<ChartTheme>(FALLBACK);

	useEffect(() => {
		const cs = getComputedStyle(document.documentElement);
		function read(name: string, fallback: string): string {
			return cs.getPropertyValue(name).trim() || fallback;
		}
		setTheme({
			charts: FALLBACK.charts.map((fb, i) => read(`--chart-${i + 1}`, fb)),
			ink: read("--ink", FALLBACK.ink),
			mute: read("--ink-mute", FALLBACK.mute),
			rule: read("--rule", FALLBACK.rule),
		});
	}, []);

	return theme;
}

/** Tooltip 用 inline style，var() 可解析，直接用变量即可。 */
export const TOOLTIP_STYLE: React.CSSProperties = {
	backgroundColor: "var(--paper-bg-2)",
	border: "1px solid var(--rule)",
	borderRadius: "0.75rem",
	fontSize: 12,
};
