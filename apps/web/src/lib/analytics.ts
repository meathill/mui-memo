/**
 * GA4 关键事件契约（对应 issue #11 / SEO-21）。
 *
 * 关键事件（需在 GA4 界面手动标为 Key event，见 docs/ga4-key-events.md）：
 * - sign_up / login（GA 推荐事件）：注册、登录成功后各发一次
 * - tutorial_complete（GA 推荐事件）：onboarding 走完
 * - first_task_created（自定义）：首次成功落库一条任务，全端只发一次
 * - task_complete（自定义，沿用旧名保历史）：任务完成
 * - app_store_click（自定义）：Web 上点 App Store 外链（下载/打开 App 的点击侧）
 *
 * 非关键诊断事件：voice_intent / task_delete / task_reopen / theme_change。
 * 只收集事件类型 + 时间，不收集任务文本（见 privacy.md）。
 */

export const GA_KEY_EVENTS = [
	"sign_up",
	"login",
	"tutorial_complete",
	"first_task_created",
	"task_complete",
	"app_store_click",
] as const;

export type GAKeyEventName = (typeof GA_KEY_EVENTS)[number];

type GAEvent =
	| { name: "sign_up"; method: "email" | "apple" }
	| { name: "login"; method: "email" | "apple" }
	| { name: "tutorial_complete" }
	| { name: "first_task_created"; method: "voice" | "manual" }
	| { name: "task_complete"; source: "today" | "all" }
	| {
			name: "app_store_click";
			location: string;
			landing_path?: string;
			platform?: "web";
	  }
	| { name: "web_trial_click"; location: string }
	| { name: "voice_intent"; intent?: string; durationMs?: number }
	| { name: "task_delete"; source: "detail" | "completed" }
	| { name: "task_reopen"; source: "detail" | "completed" }
	| { name: "theme_change"; theme: string };

type GTagCommand = "event" | "config" | "consent" | "set";
type GTag = (
	command: GTagCommand,
	name: string,
	params?: Record<string, unknown>,
) => void;

const FIRST_TASK_KEY = "muimemo:first-task-created";
const CONSENT_KEY = "muimemo:consent";

function getGtag(): GTag | undefined {
	if (typeof window === "undefined") return undefined;
	return (window as unknown as { gtag?: GTag }).gtag;
}

export function track(event: GAEvent) {
	const gtag = getGtag();
	if (!gtag) return;
	const { name, ...params } = event;
	gtag("event", name, params);
}

/**
 * 首次记录：全端只发一次。靠 localStorage 去重，换设备/清缓存会重发，
 * 服务端以 DB 为准做最终复核（见 docs/ga4-key-events.md）。
 * @returns 是否真的发出（去重命中返回 false）
 */
export function trackFirstTaskCreated(method: "voice" | "manual"): boolean {
	try {
		if (window.localStorage.getItem(FIRST_TASK_KEY)) return false;
		window.localStorage.setItem(FIRST_TASK_KEY, "1");
	} catch {
		// localStorage 不可用时不去重，直接发，避免丢关键转化
	}
	track({ name: "first_task_created", method });
	return true;
}

export function hasTrackedFirstTask(): boolean {
	try {
		return Boolean(window.localStorage.getItem(FIRST_TASK_KEY));
	} catch {
		return false;
	}
}

export function trackAppStoreClick(location: string) {
	let landing_path: string | undefined;
	try {
		landing_path = window.location.pathname;
	} catch {}
	track({ name: "app_store_click", location, landing_path, platform: "web" });
}

/** 登录态已知后调用，让 GA4 用 user_id 做跨端关联（Web 侧；App 侧以 DB 为准）。 */
export function identifyUser(userId: string) {
	getGtag()?.("config", "", { user_id: userId });
	getGtag()?.("set", "user_properties", { user_id: userId });
}

// ---- Consent Mode v2（基础版）：ad_* 默认拒绝，analytics 按存量选择 ----

export function initConsentFromStorage() {
	let granted = true;
	try {
		const stored = window.localStorage.getItem(CONSENT_KEY);
		if (stored === "denied") granted = false;
	} catch {}
	getGtag()?.("consent", "update", {
		ad_storage: "denied",
		ad_user_data: "denied",
		ad_personalization: "denied",
		analytics_storage: granted ? "granted" : "denied",
	});
}

export function grantAnalyticsConsent() {
	try {
		window.localStorage.setItem(CONSENT_KEY, "granted");
	} catch {}
	getGtag()?.("consent", "update", { analytics_storage: "granted" });
}

export function denyAnalyticsConsent() {
	try {
		window.localStorage.setItem(CONSENT_KEY, "denied");
	} catch {}
	getGtag()?.("consent", "update", { analytics_storage: "denied" });
}
