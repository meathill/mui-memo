// @vitest-environment node

import { parseUtteranceFlexible } from "@mui-memo/shared/validators";
import {
	APIConnectionError,
	APIConnectionTimeoutError,
	APIError,
} from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getIntentTarget } from "./intent";
import { logIntentFailure } from "./intent-error";

const context = {
	userId: "user-test",
	country: "CN",
	provider: "openai" as const,
	model: "mimo-v2.6-flash",
	endpoint: "https://opencode.ai/zen/go/v1/chat/completions",
	audioMimeType: "audio/mp4",
	audioBytes: 1024,
	rayId: "test-ray-CAN",
};

afterEach(() => vi.restoreAllMocks());

function captureLog(error: unknown, privateValues: string[] = []) {
	const spy = vi.spyOn(console, "error").mockImplementation(() => {});
	logIntentFailure(error, context, privateValues);
	const serialized = spy.mock.calls.at(-1)?.[0] as string;
	return { serialized, log: JSON.parse(serialized) };
}

describe("语音失败 JSON 日志", () => {
	it.each([400, 401, 429, 500])("记录 %i 详情及 cause", (status) => {
		const cause = new APIError(
			status,
			{
				message: "audio unsupported",
				code: "invalid_audio",
				type: "invalid_request_error",
				param: "input_audio",
			},
			undefined,
			new Headers({ "x-request-id": "upstream-id" }),
		);
		const { log } = captureLog(new Error("MiMo failed", { cause }));
		expect(log).toMatchObject({
			...context,
			message: "[api/intent] ai_failed",
			error: {
				name: "Error",
				message: "MiMo failed",
				stack: expect.stringContaining("MiMo failed"),
				cause: {
					status,
					code: "invalid_audio",
					type: "invalid_request_error",
					param: "input_audio",
					requestID: "upstream-id",
					message: expect.stringContaining("audio unsupported"),
				},
			},
		});
	});

	it.each([
		new APIConnectionError({ cause: new Error("fetch failed") }),
		new APIConnectionTimeoutError(),
	])("保留连接异常 $message", (error) => {
		const { log } = captureLog(new Error("MiMo failed", { cause: error }));
		expect(log.error.cause.message).toBe(error.message);
		expect(log.error.cause.status).toBeUndefined();
		if (error.cause) expect(log.error.cause.cause.message).toBe("fetch failed");
	});

	it("不序列化 SDK 附带的请求、响应、headers 或 body，并过滤消息中的敏感值", () => {
		const error = Object.assign(
			new Error("denied test-secret Bearer auth-secret 私密任务"),
			{
				headers: { Authorization: "auth-secret" },
				request: {
					messages: [{ content: "完整 prompt" }],
					audio: "短音频 Base64",
				},
				response: { content: "完整模型回答" },
				error: { data: "原始 body" },
			},
		);
		const { serialized } = captureLog(error, ["test-secret", "私密任务"]);
		for (const value of [
			"test-secret",
			"auth-secret",
			"私密任务",
			"完整 prompt",
			"短音频 Base64",
			"完整模型回答",
			"原始 body",
		])
			expect(serialized).not.toContain(value);
		expect(serialized).toContain("denied");
	});

	it("JSON 解析异常不泄露模型回答，仍保留栈位置", () => {
		let failure: unknown;
		try {
			JSON.parse("私密模型回答");
		} catch (error) {
			failure = error;
		}
		const { serialized, log } = captureLog(failure);
		expect(serialized).not.toContain("私密模型回答");
		expect(log.error).toMatchObject({
			name: "SyntaxError",
			message: "AI 响应 JSON 解析失败",
			stack: expect.stringContaining("at "),
		});
	});

	it("SDK 将 body 放入 message 时过滤请求和模型回答", () => {
		const failure = new APIError(
			500,
			{
				code: "bad_response",
				request: { prompt: "私密 prompt" },
				response: { content: "私密回答" },
			},
			undefined,
			new Headers(),
		);
		const { serialized } = captureLog(
			new Error(`${failure.message} · sentMime=audio/mp4`, { cause: failure }),
		);
		expect(serialized).toContain("bad_response");
		expect(serialized).not.toContain("私密 prompt");
		expect(serialized).not.toContain("私密回答");
	});

	it("结构校验异常隐藏输入值，保留校验失败类别", () => {
		let failure: unknown;
		try {
			parseUtteranceFlexible({
				raw: "私密模型回答",
				actions: [{ intent: "私密无效枚举" }],
			});
		} catch (error) {
			failure = error;
		}
		const { serialized, log } = captureLog(failure);
		expect(log.error.message).toBe("AI 响应结构校验失败");
		expect(serialized).not.toContain("私密");
	});

	it("循环 cause 和非 Error 值可序列化", () => {
		const error = new Error("loop");
		error.cause = error;
		expect(captureLog(error).log.error.cause.message).toBe("cause 链已截断");
		expect(captureLog("failed").log.error.message).toBe("failed");
		expect(captureLog(null).log.error.message).toBe("unknown");
	});

	it("端点剔除凭据和查询参数", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		logIntentFailure(new Error("failed"), {
			...context,
			endpoint: "https://name:password@example.test/v1?key=secret#fragment",
		});
		expect(JSON.parse(spy.mock.calls[0][0]).endpoint).toBe(
			"https://example.test/v1",
		);
	});

	it("实际模型与端点按 provider 路由生成", () => {
		const env = {
			OPENAI_MODEL: "mimo-v2.6-flash",
			OPENAI_BASE_URL: "https://opencode.ai/zen/go/v1/",
		};
		expect(getIntentTarget(env, "CN")).toEqual({
			provider: "openai",
			model: context.model,
			endpoint: context.endpoint,
		});
		expect(getIntentTarget(env, "US")).toMatchObject({
			provider: "gemini",
			model: "gemini-3-flash-preview",
			endpoint:
				"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
		});
		expect(
			getIntentTarget(
				{ ...env, CF_ACCOUNT_ID: "account", CF_AI_GATEWAY_ID: "gateway" },
				"US",
			).endpoint,
		).toContain("/account/gateway/google-ai-studio/v1beta/");
	});
});
