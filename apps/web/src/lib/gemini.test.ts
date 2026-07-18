/**
 * @vitest-environment node
 *
 * gemini.ts 的 parseVoiceIntent / parseTextIntent 单测：重点覆盖 response.text 为空时
 * 从 SDK 诊断字段（promptFeedback / candidates[0].finishReason）拼出的错误信息。
 * genai 是纯依赖注入的假对象，不需要真实 API key / 网络，也不会实例化真正的 GoogleGenAI。
 */
import type { GoogleGenAI } from "@google/genai";
import { describe, expect, it } from "vitest";
import { parseTextIntent, parseVoiceIntent } from "./gemini";
import type { TimeAnchor } from "./intent-shared";

const now: TimeAnchor = {
	iso: "2026-07-18T10:00:00+08:00",
	tz: "Asia/Shanghai",
	weekday: "周六",
};

function fakeGenai(response: unknown): GoogleGenAI {
	return {
		models: { generateContent: async () => response },
	} as unknown as GoogleGenAI;
}

describe("parseVoiceIntent", () => {
	it("response.text 有值时正常解析并返回 Utterance", async () => {
		const genai = fakeGenai({
			text: '{"raw":"测试","actions":[{"intent":"ADD","task":{}}]}',
		});
		const result = await parseVoiceIntent({
			genai,
			audio: new ArrayBuffer(4),
			audioMimeType: "audio/mp4",
			currentTasks: [],
			now,
		});
		expect(result.raw).toBe("测试");
	});

	it("promptFeedback.blockReason 存在时，错误信息包含 blockReason 与 blockReasonMessage", async () => {
		const genai = fakeGenai({
			text: "",
			promptFeedback: {
				blockReason: "SAFETY",
				blockReasonMessage: "输入触发安全策略",
			},
		});
		await expect(
			parseVoiceIntent({
				genai,
				audio: new ArrayBuffer(4),
				audioMimeType: "audio/mp4",
				currentTasks: [],
				now,
			}),
		).rejects.toThrow(/SAFETY.*输入触发安全策略/s);
	});

	it("candidates[0].finishReason 非 STOP 时，错误信息包含 finishReason 与 finishMessage", async () => {
		const genai = fakeGenai({
			text: "",
			candidates: [{ finishReason: "MAX_TOKENS", finishMessage: "输出被截断" }],
		});
		await expect(
			parseVoiceIntent({
				genai,
				audio: new ArrayBuffer(4),
				audioMimeType: "audio/mp4",
				currentTasks: [],
				now,
			}),
		).rejects.toThrow(/MAX_TOKENS.*输出被截断/s);
	});

	it("finishReason 为 STOP 但 text 仍为空时，不误报 STOP，退回通用提示", async () => {
		const genai = fakeGenai({
			text: "",
			candidates: [{ finishReason: "STOP" }],
		});
		await expect(
			parseVoiceIntent({
				genai,
				audio: new ArrayBuffer(4),
				audioMimeType: "audio/mp4",
				currentTasks: [],
				now,
			}),
		).rejects.toThrow("Gemini returned empty content");
	});

	it("既无 promptFeedback 也无 candidate 时，退回通用提示", async () => {
		const genai = fakeGenai({ text: "" });
		await expect(
			parseVoiceIntent({
				genai,
				audio: new ArrayBuffer(4),
				audioMimeType: "audio/mp4",
				currentTasks: [],
				now,
			}),
		).rejects.toThrow("Gemini returned empty content");
	});
});

describe("parseTextIntent", () => {
	it("同样使用共享的诊断逻辑（验证两个入口共用同一套拼接）", async () => {
		const genai = fakeGenai({
			text: "",
			promptFeedback: { blockReason: "PROHIBITED_CONTENT" },
		});
		await expect(
			parseTextIntent({ genai, text: "随便说点什么", currentTasks: [], now }),
		).rejects.toThrow(/PROHIBITED_CONTENT/);
	});
});
