// @vitest-environment node
import { APIError } from "openai";
import { afterEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), persist: vi.fn() }));
vi.mock("@/lib/route", () => ({
	requireAuthDb: async () => [
		null,
		{
			db: {},
			session: { user: { id: "user-test" } },
			env: {
				OPENAI_API_KEY: "test-secret",
				OPENAI_BASE_URL: "https://opencode.ai/zen/go/v1",
				OPENAI_MODEL: "mimo-v2.5",
			},
		},
	],
}));
vi.mock("@/lib/intent", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/intent")>()),
	resolveAndParseVoiceIntent: mocks.resolve,
}));
vi.mock("@/lib/tasks", () => ({
	listTasksForUser: async () => [],
	listRecentTagCandidatesForUser: async () => [],
	mergeTagCandidates: () => [],
	persistIntentResult: mocks.persist,
}));
vi.mock("@/lib/search", () => ({ resolveTargetTask: vi.fn() }));

afterEach(() => {
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

it("失败接口保持 502/detail，输出单条包含真实目标和上游原因的 JSON 日志", async () => {
	const upstream = new APIError(
		429,
		{ message: "quota exceeded", code: "rate_limit", type: "rate_limit_error" },
		undefined,
		new Headers({ "x-request-id": "upstream-id" }),
	);
	const error = new Error("MiMo quota exceeded", { cause: upstream });
	mocks.resolve.mockRejectedValue(error);
	const logger = vi.spyOn(console, "error").mockImplementation(() => {});
	const form = new FormData();
	form.set("userId", "client-supplied-user");
	form.set(
		"audio",
		new Blob(["test-audio"], { type: "audio/mp4" }),
		"clip.m4a",
	);
	const response = await POST(
		new Request("https://example.test/api/intent", {
			method: "POST",
			body: form,
			headers: {
				"cf-ipcountry": "CN",
				"cf-ray": "test-ray",
				"x-opencode-session": "client-supplied-session",
			},
		}),
	);
	expect(response.status).toBe(502);
	expect(mocks.resolve).toHaveBeenCalledWith(
		expect.anything(),
		expect.objectContaining({ userId: "user-test" }),
	);
	expect(await response.json()).toEqual({
		error: "ai_failed",
		detail: error.message,
	});
	expect(logger).toHaveBeenCalledTimes(1);
	expect(logger.mock.calls[0]).toHaveLength(1);
	expect(JSON.parse(logger.mock.calls[0][0])).toMatchObject({
		message: "[api/intent] ai_failed",
		provider: "openai",
		model: "mimo-v2.5",
		endpoint: "https://opencode.ai/zen/go/v1/chat/completions",
		rayId: "test-ray",
		audioMimeType: "audio/mp4",
		audioBytes: 10,
		error: {
			message: error.message,
			cause: { status: 429, requestID: "upstream-id" },
		},
	});
	expect(logger.mock.calls[0][0]).not.toContain("test-secret");
	expect(mocks.persist).not.toHaveBeenCalled();
});
