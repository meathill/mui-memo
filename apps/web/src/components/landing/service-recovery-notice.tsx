import { CircleCheckIcon } from "lucide-react";

export function ServiceRecoveryNotice() {
	return (
		<div
			aria-live="polite"
			className="mt-1 mb-10 flex items-start gap-3 border-y border-accent-good/35 bg-accent-good/[0.07] py-3.5 text-ink sm:mb-12 sm:items-center"
			role="status"
		>
			<CircleCheckIcon
				aria-hidden
				className="mt-0.5 size-4.5 shrink-0 text-accent-good sm:mt-0"
				strokeWidth={1.8}
			/>
			<div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
				<span className="font-mono text-[0.68rem] tracking-[0.16em] text-accent-good uppercase sm:text-[0.74rem]">
					服务状态 · 已恢复
				</span>
				<p className="text-[0.92rem] leading-relaxed text-ink-soft sm:text-[0.98rem]">
					此前影响语音记录的故障已经修复，请大家放心使用。
				</p>
			</div>
		</div>
	);
}
