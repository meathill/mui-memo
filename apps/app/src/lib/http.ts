import Constants from "expo-constants";
import { getToken, useSession } from "./session";

/**
 * API base URL。dev 从 app.json 的 extra.apiBase 注入（通常是局域网里电脑的
 * IP + :3000，不能用 localhost —— 真机 / 模拟器访问不到宿主 loopback）。
 */
export const API_BASE = (() => {
	const fromExtra = (
		Constants.expoConfig?.extra as { apiBase?: string } | undefined
	)?.apiBase;
	if (!fromExtra) {
		throw new Error("app.json extra.apiBase 没配");
	}
	return fromExtra.replace(/\/$/, "");
})();

export class ApiError extends Error {
	constructor(
		message: string,
		public status: number,
		public detail?: unknown,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export type JsonInit = Omit<RequestInit, "body" | "headers"> & {
	body?: unknown;
	headers?: Record<string, string>;
};

/** 统一 fetch：自动带 Authorization header，JSON 序列化，错误走 ApiError */
export async function request<T>(
	path: string,
	init: JsonInit = {},
): Promise<T> {
	const headers: Record<string, string> = {
		Accept: "application/json",
		...init.headers,
	};
	const token = getToken();
	if (token) headers.Authorization = `Bearer ${token}`;

	const method = (init.method ?? "GET").toUpperCase();
	let body: BodyInit | undefined;
	if (init.body instanceof FormData) {
		body = init.body;
		// 不要手动设 Content-Type，让 fetch 自己加 boundary
	} else if (init.body !== undefined) {
		headers["Content-Type"] = "application/json";
		body = JSON.stringify(init.body);
	} else if (method !== "GET" && method !== "HEAD") {
		// Better-Auth 的 /sign-out 等无 body POST 也强制要求 Content-Type:
		// application/json，否则 415 UNSUPPORTED_MEDIA_TYPE。空 body 用 '{}' 兜
		headers["Content-Type"] = "application/json";
		body = "{}";
	}

	const res = await fetch(`${API_BASE}${path}`, { ...init, headers, body });
	if (res.status === 401) {
		await useSession.getState().clearSession();
		throw new ApiError("未登录", 401);
	}
	const text = await res.text();
	const data = text ? safeJson(text) : undefined;
	if (!res.ok) {
		const msg =
			(data && typeof data === "object" && "error" in data
				? String((data as { error?: unknown }).error)
				: text) || res.statusText;
		throw new ApiError(msg, res.status, data);
	}
	return data as T;
}

function safeJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}
