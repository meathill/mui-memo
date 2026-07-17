/**
 * AI prompt 行为评估 cases。配套 `intent-prompt.eval.test.ts` 跑真实 Gemini。
 *
 * 每条 case 给出用户的一句话 + 当前清单，断言 AI 返回的 actions[] 关键字段。
 * 不锁文案细节，只断言结构（intent、关键 token、字段是否填）。
 *
 * 改 prompt 后跑这套就能看出哪里行为变了。
 */

import type {
	TaskPlace,
	TaskStatus,
	TaskWindow,
} from "@mui-memo/shared/validators";

export interface ExpectedAction {
	intent: "ADD" | "STATUS" | "DONE" | "MODIFY" | "LINK";
	/** ADD 时：task.text 应包含的子串 */
	taskTextContains?: string;
	/** STATUS/DONE/MODIFY/LINK 时：match 字段应包含的子串 */
	matchContains?: string;
	/** MODIFY 时：patch.text 应包含的子串 */
	patchTextContains?: string;
	/** ADD 时：是否应填 expectAt */
	hasExpectAt?: boolean;
	/** ADD 时：是否应填 dueAt */
	hasDueAt?: boolean;
	/** ADD 时：expectAt 应不填（时间宁缺毋滥） */
	hasNoExpectAt?: boolean;
	/** ADD 时：dueAt 应不填 */
	hasNoDueAt?: boolean;
	/** MODIFY 时：patch.expectAt 是否应填 */
	patchHasExpectAt?: boolean;
	/** STATUS 时：patch.status 应为某值 */
	patchStatus?: TaskStatus;
}

export interface TaskFixture {
	id: string;
	text: string;
	place?: TaskPlace;
	window?: TaskWindow;
	status?: TaskStatus;
}

export interface PromptEvalCase {
	name: string;
	/** 用户的一句中文原话 */
	text: string;
	/** 当前清单里已存在的任务（喂给 AI 当上下文） */
	currentTasks?: TaskFixture[];
	/** 期望 actions[]，长度和顺序需匹配 */
	expected: ExpectedAction[];
	/** 注释（来源 / 关键意图） */
	comment?: string;
}

export const CASES: PromptEvalCase[] = [
	// ─── 回归 v0.8 的误判 bug ───────────────────────────
	{
		name: "朋友 bug 回归：「完了转需要提供快递单号」紧跟另一条独立任务，应当 ADD 不是 MODIFY",
		text: "完了转需要提供快递单号",
		currentTasks: [
			{ id: "a", text: "提供货单给高老师", place: "work", window: "today" },
		],
		expected: [{ intent: "ADD", taskTextContains: "快递" }],
		comment:
			'v0.8 时 AI 误判 MODIFY 把第一条 text 改成了"提供快递单号给高老师"',
	},
	{
		name: "过渡词「另外」开头：新增不是修改",
		text: "另外明天买菜",
		currentTasks: [
			{ id: "a", text: "交物业费", place: "home", window: "today" },
		],
		expected: [{ intent: "ADD", taskTextContains: "买菜", hasExpectAt: true }],
	},
	{
		name: "过渡词「对了」：新增不是修改",
		text: "对了还要给老妈打电话",
		currentTasks: [{ id: "a", text: "写周报", place: "work", window: "today" }],
		expected: [{ intent: "ADD", taskTextContains: "老妈" }],
	},

	// ─── 多任务拆分 ─────────────────────────────────────
	{
		name: "一句两件独立事：「打电话给老妈，再交物业费」 → 2 个 ADD",
		text: "打电话给老妈，再交物业费",
		expected: [
			{ intent: "ADD", taskTextContains: "老妈" },
			{ intent: "ADD", taskTextContains: "物业" },
		],
	},

	// ─── 显式 MODIFY 信号 ────────────────────────────────
	{
		name: "显式「改到」：MODIFY 命中现有任务，patch 带 expectAt",
		text: "把买菜改到下午三点",
		currentTasks: [{ id: "a", text: "买菜", place: "out", window: "today" }],
		expected: [
			{ intent: "MODIFY", matchContains: "买菜", patchHasExpectAt: true },
		],
	},

	// ─── STATUS / DONE / LINK ─────────────────────────────
	{
		name: "「我开始 X」走 STATUS，patch.status=doing",
		text: "我现在开始写报告",
		currentTasks: [
			{ id: "a", text: "写月度报告", place: "work", window: "today" },
		],
		expected: [
			{ intent: "STATUS", matchContains: "报告", patchStatus: "doing" },
		],
	},
	{
		name: "完成时态：「物业费搞定了」 → DONE",
		text: "物业费搞定了",
		currentTasks: [
			{ id: "a", text: "交物业费", place: "home", window: "today" },
		],
		expected: [{ intent: "DONE", matchContains: "物业" }],
	},
	{
		name: "「顺便」但清单无 doing：走 ADD 不走 LINK",
		text: "顺便订一下午茶",
		currentTasks: [],
		expected: [{ intent: "ADD", taskTextContains: "下午茶" }],
	},

	// ─── 时间字段宁缺毋滥 ─────────────────────────────────
	{
		name: "原话无时间词：expectAt / dueAt 都不应填",
		text: "记得给老妈打电话",
		expected: [
			{
				intent: "ADD",
				taskTextContains: "老妈",
				hasNoExpectAt: true,
				hasNoDueAt: true,
			},
		],
	},
	{
		name: "「最晚」型截止：dueAt 应填，expectAt 不填",
		text: "下周一前把物业费交了",
		expected: [
			{
				intent: "ADD",
				taskTextContains: "物业",
				hasNoExpectAt: true,
				hasDueAt: true,
			},
		],
	},

	// ─── 具体时间 ──────────────────────────────────────────
	{
		name: "具体时刻 → expectAt 应填",
		text: "明天上午 10 点把货单提供给高老师",
		expected: [{ intent: "ADD", taskTextContains: "货单", hasExpectAt: true }],
	},
];
