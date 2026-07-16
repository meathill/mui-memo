import type { RecurrenceFreq } from "./validators.js";

/**
 * 跨端 API 响应 DTO。web 与 app 共用，避免各自重复声明导致字段/可空性漂移。
 * 这里只放「读」回来的响应形状；请求入参（带 zod 校验）见 validators。
 */

/** 已完成任务列表项（GET /api/tasks/completed 的行） */
export interface CompletedTask {
	id: string;
	text: string;
	tags: string[];
	completedAt: string | null;
}

/** 任务附件（GET /api/tasks/[id] 的 attachments）。mime / size 在 DB 里可能为空。 */
export interface Attachment {
	id: string;
	key: string;
	mime: string | null;
	size: number | null;
	originalName: string | null;
	createdAt: string;
}

/** 周期任务定义摘要（任务详情里回带，用于「重复」开关状态） */
export interface RecurrenceInfo {
	id: string;
	freq: RecurrenceFreq;
	interval: number;
}

/** 「我的」页统计（GET /api/profile/stats） */
export interface ProfileStats {
	user: { name: string; email: string };
	stats: {
		total: number;
		pending: number;
		doing: number;
		done: number;
		doneToday: number;
	};
}
