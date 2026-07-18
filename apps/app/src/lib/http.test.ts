/**
 * http.ts request() 的错误信息提取单测。mock 掉 expo-constants 和 ./session：
 * - expo-constants：http.ts 顶层的 API_BASE 是个 IIFE，读不到 extra.apiBase 就直接 throw；
 *   vitest 的 node 环境没有真实 Expo/Metro 运行时能填这个值，必须整体 mock 掉这个模块
 *  （vi.mock 替换整个模块，真正的 expo-constants 源文件不会被求值）。
 * - ./session：只需要 getToken() 返回 null、clearSession() 是个 no-op，避免引入
 *   expo-secure-store 的同类不确定性。
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
	default: { expoConfig: { extra: { apiBase: "https://test.example" } } },
}));
vi.mock("./session", () => ({
	getToken: () => null,
	useSession: { getState: () => ({ clearSession: async () => undefined }) },
}));

import { ApiError, request } from "./http";

function jsonResponse(
	status: number,
	body?: unknown,
	statusText = "Bad Gateway",
): Response {
	return new Response(body === undefined ? null : JSON.stringify(body), {
		status,
		statusText,
		headers: { "Content-Type": "application/json" },
	});
}

function stubFetch(res: Response) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => res),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("request() 对失败响应的错误信息提取", () => {
	it("body 同时有 error 和 detail 时，优先用 detail（如 /api/intent 的 ai_failed）", async () => {
		stubFetch(
			jsonResponse(502, {
				error: "ai_failed",
				detail: "Gemini blocked the prompt (SAFETY)",
			}),
		);
		const err = (await request("/api/intent").catch((e) => e)) as ApiError;
		expect(err).toBeInstanceOf(ApiError);
		expect(err.message).toBe("Gemini blocked the prompt (SAFETY)");
		expect(err.status).toBe(502);
	});

	it("body 只有 error、没有 detail 时，保持原行为（如 missing audio）", async () => {
		stubFetch(jsonResponse(400, { error: "missing audio" }));
		const err = (await request("/api/intent").catch((e) => e)) as ApiError;
		expect(err.message).toBe("missing audio");
	});

	it("detail 为空字符串时视为不可用，退回 error", async () => {
		stubFetch(jsonResponse(502, { error: "ai_failed", detail: "" }));
		const err = (await request("/api/intent").catch((e) => e)) as ApiError;
		expect(err.message).toBe("ai_failed");
	});

	it("detail 不是字符串时视为不可用，退回 error", async () => {
		stubFetch(
			jsonResponse(502, { error: "ai_failed", detail: { weird: true } }),
		);
		const err = (await request("/api/intent").catch((e) => e)) as ApiError;
		expect(err.message).toBe("ai_failed");
	});

	it("body 不是 JSON（纯文本）时，退回原始文本", async () => {
		stubFetch(
			new Response("upstream 502", { status: 502, statusText: "Bad Gateway" }),
		);
		const err = (await request("/api/intent").catch((e) => e)) as ApiError;
		expect(err.message).toBe("upstream 502");
	});

	it("body 完全为空时，退回 res.statusText", async () => {
		stubFetch(new Response(null, { status: 502, statusText: "Bad Gateway" }));
		const err = (await request("/api/intent").catch((e) => e)) as ApiError;
		expect(err.message).toBe("Bad Gateway");
	});

	it("401 时忽略 body，走既有的清 session + 固定「未登录」文案分支", async () => {
		stubFetch(
			jsonResponse(401, { error: "unauthorized", detail: "should be ignored" }),
		);
		const err = (await request("/api/intent").catch((e) => e)) as ApiError;
		expect(err.message).toBe("未登录");
		expect(err.status).toBe(401);
	});
});
