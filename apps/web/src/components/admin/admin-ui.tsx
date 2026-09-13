"use client";

export function StatCard({
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

export function ChartCard({
	title,
	children,
	wide,
}: {
	title: string;
	children: React.ReactNode;
	wide?: boolean;
}) {
	return (
		<section
			className={
				"rounded-2xl border border-rule/60 bg-paper-2/50 p-5 " +
				(wide ? "lg:col-span-2" : "")
			}
		>
			<h2 className="font-mono text-[10px] tracking-[0.15em] text-ink-mute uppercase">
				{title}
			</h2>
			<div className="mt-3">{children}</div>
		</section>
	);
}
