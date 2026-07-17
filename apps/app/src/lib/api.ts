import type {
	Attachment,
	CompletedTask,
	ProfileStats,
	RecurrenceInfo,
} from "@mui-memo/shared/dto";
import type { IntentEffect, TaskView } from "@mui-memo/shared/logic";
import type {
	RecurrenceFreq,
	TaskPlace,
	Utterance,
} from "@mui-memo/shared/validators";
import Constants from "expo-constants";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import { API_BASE, ApiError, request } from "./http";
import { type SessionUser, useSession } from "./session";

// HTTP 内核（API_BASE / ApiError / request）在 ./http；ApiError re-export 让
// app 内 `@/lib/api` 的现有 import 不变。
export { ApiError };

// ─── 端点封装 ──────────────────────────────────────────────

export const api = {
	auth: {
		/**
		 * Better-Auth bearer plugin：邮箱密码登录成功后，token 在响应 header
		 * `set-auth-token` 里（body 里也可能有 session 信息）。我们两边都兜一下。
		 */
		async signInEmail(email: string, password: string) {
			const res = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({ email, password }),
			});
			if (!res.ok) {
				const err = await res.text();
				throw new ApiError(err || "登录失败", res.status);
			}
			const token =
				res.headers.get("set-auth-token") ?? res.headers.get("Set-Auth-Token");
			const data = (await res.json()) as {
				token?: string;
				user?: SessionUser;
			};
			const finalToken = token ?? data.token;
			if (!finalToken || !data.user) {
				throw new ApiError("登录响应缺少 token 或 user", 500, data);
			}
			await useSession.getState().setSession(finalToken, data.user);
			return data.user;
		},
		async signUpEmail(email: string, password: string, name: string) {
			const res = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({ email, password, name }),
			});
			if (!res.ok) {
				const err = await res.text();
				throw new ApiError(err || "注册失败", res.status);
			}
			const token =
				res.headers.get("set-auth-token") ?? res.headers.get("Set-Auth-Token");
			const data = (await res.json()) as {
				token?: string;
				user?: SessionUser;
			};
			const finalToken = token ?? data.token;
			if (!finalToken || !data.user) {
				throw new ApiError("注册响应缺少 token 或 user", 500, data);
			}
			await useSession.getState().setSession(finalToken, data.user);
			return data.user;
		},
		async signOut() {
			try {
				await request("/api/auth/sign-out", { method: "POST" });
			} finally {
				await useSession.getState().clearSession();
			}
		},
		/**
		 * Sign in with Apple（原生）：iOS 拿到 identityToken 后直接 POST。
		 * Better-Auth 的 /sign-in/social 会验签并建/登 session，返回 token+user。
		 * `fullName` 只在第一次授权时有值，要的话得赶紧存下来。
		 */
		async signInWithApple(params: {
			identityToken: string;
			nonce?: string;
			fullName?: {
				givenName?: string | null;
				familyName?: string | null;
			} | null;
		}) {
			// Better-Auth 的 idToken.user.name 必须是 { firstName, lastName } 对象，
			// 不能传普通字符串，否则 415 VALIDATION_ERROR
			const firstName = params.fullName?.givenName ?? undefined;
			const lastName = params.fullName?.familyName ?? undefined;
			const userPayload =
				firstName || lastName ? { name: { firstName, lastName } } : undefined;

			const res = await fetch(`${API_BASE}/api/auth/sign-in/social`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({
					provider: "apple",
					idToken: {
						token: params.identityToken,
						nonce: params.nonce,
						user: userPayload,
					},
				}),
			});
			if (!res.ok) {
				const err = await res.text();
				throw new ApiError(err || "Apple 登录失败", res.status);
			}
			const headerToken =
				res.headers.get("set-auth-token") ?? res.headers.get("Set-Auth-Token");
			const data = (await res.json()) as {
				token?: string;
				user?: SessionUser;
			};
			const finalToken = headerToken ?? data.token;
			if (!finalToken || !data.user) {
				throw new ApiError("Apple 登录响应缺少 token 或 user", 500, data);
			}
			await useSession.getState().setSession(finalToken, data.user);
			return data.user;
		},
		/** 启动时带 token 去刷一份用户信息。失败就当 token 过期，clear 掉 */
		async getSession(): Promise<SessionUser | null> {
			try {
				const data = await request<{ user?: SessionUser } | null>(
					"/api/auth/get-session",
				);
				return data?.user ?? null;
			} catch (err) {
				if (err instanceof ApiError && err.status === 401) return null;
				throw err;
			}
		},
	},

	account: {
		/**
		 * 注销账号（Apple 5.1.1(v)）：永久删除服务端全部数据。成功后才清本地
		 * session 让 UI 跳登录页；失败则抛错、保留登录态，由调用方提示「注销失败」。
		 */
		async deleteAccount() {
			await request("/api/account/delete", { method: "POST" });
			await useSession.getState().clearSession();
		},
	},

	tasks: {
		list() {
			return request<{ tasks: TaskView[] }>("/api/tasks");
		},
		/** 分页；首屏不传 before，下一页传上一条 completedAt */
		completed(before?: string | null) {
			const qs = before ? `?before=${encodeURIComponent(before)}` : "";
			return request<{
				tasks: CompletedTask[];
				nextCursor: string | null;
				hasMore: boolean;
			}>(`/api/tasks/completed${qs}`);
		},
		detail(id: string) {
			return request<{
				task: TaskView;
				recurrence: RecurrenceInfo | null;
				attachments: Attachment[];
			}>(`/api/tasks/${id}`);
		},
		done(id: string) {
			return request<{ task?: TaskView }>(`/api/tasks/${id}/done`, {
				method: "POST",
			});
		},
		reopen(id: string) {
			return request<{ success: boolean }>(`/api/tasks/${id}/reopen`, {
				method: "POST",
			});
		},
		batchDone(ids: string[]) {
			return request<{ tasks: TaskView[] }>("/api/tasks/batch-done", {
				method: "POST",
				body: { taskIds: ids },
			});
		},
		delete(id: string) {
			return request<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" });
		},
		/** PATCH /api/tasks/[id] —— 手动编辑。body 只带要改的字段 */
		patch(id: string, body: Partial<TaskPatch>) {
			return request<{ ok: true }>(`/api/tasks/${id}`, {
				method: "PATCH",
				body,
			});
		},
	},

	recurrences: {
		/** 新建周期任务定义；linkTaskId 把现有任务挂成当前期实例 */
		create(body: RecurrenceInput) {
			return request<{ recurrence: RecurrenceInfo }>("/api/recurrences", {
				method: "POST",
				body,
			});
		},
		update(id: string, body: Partial<RecurrenceInput>) {
			return request<{ ok: true }>(`/api/recurrences/${id}`, {
				method: "PATCH",
				body,
			});
		},
		/** 关闭重复：删定义，未完成实例 unlink 成普通任务 */
		delete(id: string) {
			return request<{ ok: true }>(`/api/recurrences/${id}`, {
				method: "DELETE",
			});
		},
	},

	intent: {
		/**
		 * 提交录音走 multipart。
		 *
		 * Expo SDK 56 起默认把全局 `fetch` 换成 expo 自家的 winter fetch，它把 FormData 交给
		 * `convertFormDataAsync`，只认 string / Blob / 带 `bytes()` 的对象——RN 专有的
		 * `{ uri, name, type }` 文件分片会直接 throw `Unsupported FormDataPart implementation`。
		 * 所以这里改成提供 `name`/`type`（生成分片头）+ `bytes()`（取字节），与旧版上线格式一致
		 * （filename=utterance.<ext>、content-type=mimeType），服务端无需改动。
		 */
		async submit(opts: {
			audioUri: string;
			mimeType: string;
			place: TaskPlace;
			tz: string;
			tagCandidates?: string[];
		}) {
			const fd = new FormData();
			const ext = opts.mimeType.includes("wav")
				? "wav"
				: opts.mimeType.includes("webm")
					? "webm"
					: "m4a";
			const file = new File(opts.audioUri);
			fd.append("audio", {
				name: `utterance.${ext}`,
				type: opts.mimeType,
				bytes: async () => new Uint8Array(await file.arrayBuffer()),
			} as unknown as Blob);
			fd.append("place", opts.place);
			fd.append("tz", opts.tz);
			if (opts.tagCandidates?.length)
				fd.append("tagCandidates", JSON.stringify(opts.tagCandidates));
			return request<{
				utterance: Utterance;
				effects: IntentEffect[];
				tasks: TaskView[];
				pendingConfirms: Array<{ index: number; effect: IntentEffect }>;
			}>("/api/intent", { method: "POST", body: fd });
		},
		confirm(
			body:
				| { kind: "modify"; taskId: string; patch: Record<string, unknown> }
				| {
						kind: "modify-as-add";
						rawText: string;
						task: Record<string, unknown>;
						aiReason?: string;
				  }
				| { kind: "done"; taskId: string },
		) {
			return request<{ tasks: TaskView[] }>("/api/intent/confirm", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
		},
	},

	utterances: {
		list() {
			return request<{ utterances: Utterance[] }>("/api/utterances");
		},
	},

	profile: {
		stats() {
			return request<ProfileStats>("/api/profile/stats");
		},
	},

	feedback: {
		/**
		 * 反馈后端 (app-feedback) 不需要鉴权，独立域名，所以不走 request()，
		 * 直接 fetch 避免被注入 Authorization header
		 */
		async submit(payload: {
			content: string;
			contact?: string;
			tags?: string[];
		}) {
			const base = (
				(
					Constants.expoConfig?.extra as
						| { feedbackApiBase?: string }
						| undefined
				)?.feedbackApiBase ?? "https://feedback.meathill.com"
			).replace(/\/$/, "");
			const body = {
				appId: "mui-memo-app",
				version: Constants.expoConfig?.version,
				deviceInfo: {
					os: Platform.OS,
					osVersion: String(Platform.Version),
				},
				content: payload.content,
				contact: payload.contact || undefined,
				tags: payload.tags?.length ? payload.tags : undefined,
			};
			const res = await fetch(`${base}/api/feedbacks`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			if (!res.ok) {
				throw new ApiError(`提交失败 (${res.status})`, res.status);
			}
		},
	},
};

/**
 * 手动编辑可传的字段。对齐 apps/web PATCH 的 patchSchema（taskCoreSchema.partial + status）。
 * tags 传空数组代表清空；deadline 允许传 null 代表清空。
 */
export interface TaskPatch {
	text: string;
	place: TaskPlace;
	window: "now" | "today" | "later";
	energy: number;
	priority: number;
	tags: string[];
	deadline: string | null;
	expectAt: string | null;
	dueAt: string | null;
	status: "pending" | "doing" | "done";
	/** 保险箱指针（随机 UUID）：string 设置、null 清空。明文永不经过这个 API。 */
	vaultKey: string | null;
}

/** 新建/编辑周期任务入参，对齐 web recurrenceCoreSchema。空字段省略（zod 用 default/optional）。 */
export interface RecurrenceInput {
	text: string;
	place: TaskPlace;
	window: "now" | "today" | "later";
	energy?: number;
	priority?: number;
	tags?: string[];
	freq: RecurrenceFreq;
	interval: number;
	anchorAt?: string;
	/** 创建端 getTimezoneOffset() 分钟数，monthly/workday 按本地日历切分用 */
	tzOffset?: number;
	linkTaskId?: string;
}

// 响应 DTO 统一在 @mui-memo/shared/dto；re-export 让 app 内 `@/lib/api` 的现有 import 不变。
export type { Attachment, CompletedTask, ProfileStats, RecurrenceInfo };
