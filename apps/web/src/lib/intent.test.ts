/**
 * @vitest-environment node
 *
 * pickProvider 纯逻辑单测：覆盖 AI_PROVIDER 显式覆盖与 auto 模式的地区切换。
 * 用 node 环境，避免 happy-dom 注入 window 触发 OpenAI SDK 的浏览器保护
 *（intent.ts 会间接 import openai / @google/genai）。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type IntentEnv,
	pickProvider,
	resolveAndParseVoiceIntent,
} from "./intent";

afterEach(() => vi.unstubAllGlobals());

it("真实 SDK 请求携带稳定的 userId 会话头，不同用户互不串用", async () => {
	const requests: Request[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn<typeof fetch>(async (input, init) => {
			const request = new Request(input, init);
			requests.push(request);
			if (!request.headers.get("x-opencode-session")) {
				return Response.json(
					{ error: { message: "Missing session", type: "MissingSessionID" } },
					{ status: 400 },
				);
			}
			return Response.json({
				choices: [
					{
						message: {
							content: JSON.stringify({
								raw: "测试",
								actions: [{ intent: "ADD", task: {} }],
							}),
						},
					},
				],
			});
		}),
	);
	for (const userId of ["user-a", "user-a", "user-b"]) {
		const result = await resolveAndParseVoiceIntent(
			{
				OPENAI_API_KEY: "test-key",
				OPENAI_BASE_URL: "https://opencode.ai/zen/go/v1",
				OPENAI_MODEL: "mimo-v2.6-flash",
			},
			{
				userId,
				country: "CN",
				audio: new ArrayBuffer(4),
				audioMimeType: "audio/mp4",
				currentTasks: [],
				now: {
					iso: "2026-09-19T10:00:00+08:00",
					tz: "Asia/Shanghai",
					weekday: "周六",
				},
			},
		);
		expect(result.raw).toBe("测试");
	}
	expect(
		requests.map((request) => request.headers.get("x-opencode-session")),
	).toEqual(["user-a", "user-a", "user-b"]);
	expect(requests[0].url).toBe(
		"https://opencode.ai/zen/go/v1/chat/completions",
	);
});

const base: IntentEnv = {
	GEMINI_API_KEY: "g",
	OPENAI_API_KEY: "o",
	OPENAI_BASE_URL: "https://example/v1",
	OPENAI_MODEL: "m",
};

describe("pickProvider", () => {
	it("AI_PROVIDER 显式值强制覆盖地区", () => {
		expect(pickProvider({ ...base, AI_PROVIDER: "openai" }, "US")).toBe(
			"openai",
		);
		expect(pickProvider({ ...base, AI_PROVIDER: "gemini" }, "CN")).toBe(
			"gemini",
		);
	});

	it("auto：中国地区(CN/HK/TW/MO) → openai", () => {
		for (const cc of ["CN", "HK", "TW", "MO"]) {
			expect(pickProvider({ ...base, AI_PROVIDER: "auto" }, cc)).toBe("openai");
		}
	});

	it("auto：其余已识别地区 → gemini", () => {
		for (const cc of ["US", "JP", "GB", "SG"]) {
			expect(pickProvider({ ...base, AI_PROVIDER: "auto" }, cc)).toBe("gemini");
		}
	});

	it("auto：识别不到来源(null/undefined/空串/XX/T1) → 回退 openai", () => {
		expect(pickProvider({ ...base, AI_PROVIDER: "auto" }, null)).toBe("openai");
		expect(pickProvider({ ...base, AI_PROVIDER: "auto" }, undefined)).toBe(
			"openai",
		);
		expect(pickProvider({ ...base, AI_PROVIDER: "auto" }, "")).toBe("openai");
		expect(pickProvider({ ...base, AI_PROVIDER: "auto" }, "XX")).toBe("openai");
		expect(pickProvider({ ...base, AI_PROVIDER: "auto" }, "T1")).toBe("openai");
	});

	it("缺省（未配置 AI_PROVIDER）等价 auto", () => {
		expect(pickProvider(base, "US")).toBe("gemini");
		expect(pickProvider(base, "CN")).toBe("openai");
		expect(pickProvider(base, null)).toBe("openai");
	});

	it("地区码大小写不敏感", () => {
		expect(pickProvider({ ...base, AI_PROVIDER: "auto" }, "cn")).toBe("openai");
		expect(pickProvider({ ...base, AI_PROVIDER: "auto" }, "us")).toBe("gemini");
		expect(pickProvider({ ...base, AI_PROVIDER: "auto" }, "xx")).toBe("openai");
	});
});
