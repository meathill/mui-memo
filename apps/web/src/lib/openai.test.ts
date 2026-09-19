// @vitest-environment node
import OpenAI, {
	APIConnectionError,
	APIConnectionTimeoutError,
	APIError,
} from "openai";
import { describe, expect, it, vi } from "vitest";
import { parseVoiceIntent } from "./openai";

function createOptions() {
	const client = new OpenAI({
		apiKey: "test-key",
		baseURL: "https://example.test/v1",
		maxRetries: 0,
	});
	return {
		client,
		model: "mimo-v2.5",
		audio: new ArrayBuffer(4),
		audioMimeType: "audio/mp4",
		currentTasks: [],
		now: {
			iso: "2026-09-19T10:00:00+08:00",
			tz: "Asia/Shanghai",
			weekday: "周六",
		},
	};
}

describe("OpenAI 语音错误详情", () => {
	it.each([400, 401, 429, 500])(
		"保留上游 %i 的消息、状态和请求 ID",
		async (status) => {
			const opts = createOptions();
			const upstream = new APIError(
				status,
				{
					message: "upstream rejected audio",
					code: "invalid_audio",
					param: "messages.1.content",
					type: "invalid_request_error",
				},
				undefined,
				new Headers({ "x-request-id": "upstream-id" }),
			);
			vi.spyOn(opts.client.chat.completions, "create").mockRejectedValue(
				upstream,
			);
			const failure = await parseVoiceIntent(opts).catch(
				(error: unknown) => error,
			);
			expect(failure).toBeInstanceOf(Error);
			expect(failure).toMatchObject({
				message: expect.stringContaining("upstream rejected audio"),
				cause: { status, code: "invalid_audio", requestID: "upstream-id" },
			});
			expect((failure as Error).cause).toBe(upstream);
			expect((failure as Error).message).toContain(
				"sentMime=audio/mp4 · sentFormat=m4a",
			);
		},
	);

	it.each([
		new APIConnectionError({
			message: "Connection error.",
			cause: new Error("fetch failed"),
		}),
		new APIConnectionTimeoutError(),
		new APIError(502, undefined, "<html>Bad Gateway</html>", new Headers()),
	])("没有 JSON body 时仍保留原始消息：$message", async (upstream) => {
		const opts = createOptions();
		vi.spyOn(opts.client.chat.completions, "create").mockRejectedValue(
			upstream,
		);
		await expect(parseVoiceIntent(opts)).rejects.toMatchObject({
			message: expect.stringContaining(upstream.message),
			cause: upstream,
		});
	});

	it("非 SDK 异常保持原样", async () => {
		const opts = createOptions();
		const failure = new Error("unexpected failure");
		vi.spyOn(opts.client.chat.completions, "create").mockRejectedValue(failure);
		await expect(parseVoiceIntent(opts)).rejects.toBe(failure);
	});
});
