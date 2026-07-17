import { afterEach, describe, expect, it, vi } from "vitest";
import { hsmDeleteKey, hsmGetKey, hsmPutKey } from "./vault-hsm";
import { VaultError } from "./vault-model";

function jsonResponse(status: number, body?: unknown): Response {
	return new Response(body === undefined ? null : JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function stubFetch(impl: (url: string, init: RequestInit) => Response) {
	const mock = vi.fn(async (url: unknown, init?: RequestInit) =>
		impl(String(url), init ?? {}),
	);
	vi.stubGlobal("fetch", mock);
	return mock;
}

async function expectVaultError(
	promise: Promise<unknown>,
	kind: VaultError["kind"],
) {
	const error = await promise.then(
		() => null,
		(e: unknown) => e,
	);
	expect(error).toBeInstanceOf(VaultError);
	expect((error as VaultError).kind).toBe(kind);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("hsmPutKey", () => {
	it("PUT 到 /keys/{path}，带 X-HSM-Secret 头与 {value} body（201 也算成功）", async () => {
		const mock = stubFetch(() =>
			jsonResponse(201, { success: true, data: { path: "mui-memo/u1/k1" } }),
		);
		await hsmPutKey("mui-memo/u1/k1", "sk-secret", "deadbeef");
		expect(mock).toHaveBeenCalledOnce();
		const [url, init] = mock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://hsm.meathill.com/keys/mui-memo/u1/k1");
		expect(init.method).toBe("PUT");
		expect((init.headers as Record<string, string>)["X-HSM-Secret"]).toBe(
			"deadbeef",
		);
		expect(JSON.parse(String(init.body))).toEqual({ value: "sk-secret" });
	});

	it("403 → forbidden（条目所有权属于别的 secret）", async () => {
		stubFetch(() => jsonResponse(403));
		await expectVaultError(hsmPutKey("p", "v", "s"), "forbidden");
	});

	it("500 → server", async () => {
		stubFetch(() => jsonResponse(500));
		await expectVaultError(hsmPutKey("p", "v", "s"), "server");
	});
});

describe("hsmGetKey", () => {
	it("从 HSM envelope 的 data.value 取明文（2026-07 实测协议）", async () => {
		stubFetch(() =>
			jsonResponse(200, {
				success: true,
				data: { path: "p", value: "sk-plain" },
			}),
		);
		await expect(hsmGetKey("p", "s")).resolves.toBe("sk-plain");
	});

	it("GET 不带 body 与 Content-Type", async () => {
		const mock = stubFetch(() =>
			jsonResponse(200, { success: true, data: { value: "x" } }),
		);
		await hsmGetKey("p", "s");
		const [, init] = mock.mock.calls[0] as [string, RequestInit];
		expect(init.body).toBeUndefined();
		expect(
			(init.headers as Record<string, string>)["Content-Type"],
		).toBeUndefined();
	});

	it("404 → not_found，403 → forbidden", async () => {
		stubFetch(() => jsonResponse(404));
		await expectVaultError(hsmGetKey("p", "s"), "not_found");
		stubFetch(() => jsonResponse(403));
		await expectVaultError(hsmGetKey("p", "s"), "forbidden");
	});

	it("400 解密失败 = secret 不符 → forbidden（HSM 对 GET 不返回 403）", async () => {
		stubFetch(() =>
			jsonResponse(400, {
				success: false,
				error:
					"Decryption failed. This could be due to a ciphertext authentication failure, bad padding, incorrect CryptoKey, or another algorithm-specific reason.",
			}),
		);
		await expectVaultError(hsmGetKey("p", "s"), "forbidden");
	});

	it("其它 400（如缺 header）→ server，不误导用户换恢复码", async () => {
		stubFetch(() =>
			jsonResponse(400, {
				success: false,
				error: "Missing X-HSM-Secret header",
			}),
		);
		await expectVaultError(hsmGetKey("p", "s"), "server");
	});

	it("200 但响应缺 data.value → server（协议破损不当成功）", async () => {
		stubFetch(() => jsonResponse(200, { success: true, data: {} }));
		await expectVaultError(hsmGetKey("p", "s"), "server");
	});

	it("fetch reject → network", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Network request failed");
			}),
		);
		await expectVaultError(hsmGetKey("p", "s"), "network");
	});
});

describe("hsmDeleteKey", () => {
	it("200 与 404 都算成功（幂等删除）", async () => {
		stubFetch(() => jsonResponse(200, { ok: true }));
		await expect(hsmDeleteKey("p", "s")).resolves.toBeUndefined();
		stubFetch(() => jsonResponse(404));
		await expect(hsmDeleteKey("p", "s")).resolves.toBeUndefined();
	});

	it("403 照常抛（不可静默清指针）", async () => {
		stubFetch(() => jsonResponse(403));
		await expectVaultError(hsmDeleteKey("p", "s"), "forbidden");
	});

	it("网络失败照常抛（调用方须中止移除流程）", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Network request failed");
			}),
		);
		await expectVaultError(hsmDeleteKey("p", "s"), "network");
	});
});
