/**
 * HSM REST client。App 直连用户自有 HSM 服务，不经 mui-memo server——
 * 服务器因此永远接触不到明文与密钥。只用全局 fetch，Node 可单测。
 *
 * 协议（https://hsm.meathill.com，2026-07 用 curl 实测）：
 * - PUT /keys/:path  body {"value": "<string>"}，header X-HSM-Secret
 *   → 201 {"success":true,"data":{"path"}}；路径已存在且 secret 不符 → 403
 * - GET /keys/:path → 200 {"success":true,"data":{"path","value"}}
 *   secret 不符 → **400**（KEK 派生错导致 AES-GCM 解密失败，不是 403）
 * - DELETE /keys/:path → 200；secret 不符 → 403
 * - 不存在 → 404 "Key not found"
 */

import { HSM_BASE, VaultError } from "./vault-model";

interface HsmEnvelope {
	success?: boolean;
	data?: { path?: string; value?: unknown };
	error?: unknown;
}

function keyUrl(path: string): string {
	return `${HSM_BASE}/keys/${path}`;
}

async function hsmFetch(
	path: string,
	secret: string,
	init: { method: "GET" | "PUT" | "DELETE"; body?: string },
): Promise<Response> {
	let res: Response;
	try {
		res = await fetch(keyUrl(path), {
			method: init.method,
			headers: {
				"X-HSM-Secret": secret,
				...(init.body !== undefined
					? { "Content-Type": "application/json" }
					: {}),
			},
			body: init.body,
		});
	} catch {
		throw new VaultError("network");
	}
	return res;
}

async function throwByResponse(res: Response): Promise<never> {
	const { status } = res;
	if (status === 404) throw new VaultError("not_found", undefined, status);
	if (status === 403) throw new VaultError("forbidden", undefined, status);
	if (status === 400) {
		// 400 有两种：解密失败（= secret 不符，按 forbidden 引导换恢复码）
		// 与真正的坏请求（编程错误，按 server 处理）
		const body = (await res.json().catch(() => null)) as HsmEnvelope | null;
		const message = typeof body?.error === "string" ? body.error : "";
		if (/decrypt/i.test(message)) {
			throw new VaultError("forbidden", message, status);
		}
	}
	throw new VaultError("server", `HSM ${status}`, status);
}

/** 存/更新密文条目。同一 secret 对同一 path 重复 PUT 即覆盖。 */
export async function hsmPutKey(
	path: string,
	value: string,
	secret: string,
): Promise<void> {
	const res = await hsmFetch(path, secret, {
		method: "PUT",
		body: JSON.stringify({ value }),
	});
	if (!res.ok) await throwByResponse(res);
}

/** 取回明文。只在生物识别通过后调用，返回值不落任何持久层。 */
export async function hsmGetKey(path: string, secret: string): Promise<string> {
	const res = await hsmFetch(path, secret, { method: "GET" });
	if (!res.ok) await throwByResponse(res);
	const body = (await res.json().catch(() => null)) as HsmEnvelope | null;
	const value = body?.data?.value;
	if (typeof value !== "string") {
		throw new VaultError("server", "HSM 响应缺少 data.value");
	}
	return value;
}

/** 删除条目。404 视为成功（幂等）；403/网络失败照常抛，由调用方决策。 */
export async function hsmDeleteKey(
	path: string,
	secret: string,
): Promise<void> {
	const res = await hsmFetch(path, secret, { method: "DELETE" });
	if (res.ok || res.status === 404) return;
	await throwByResponse(res);
}
