import type { TaskView } from "@mui-memo/shared/logic";
import type { Utterance } from "@mui-memo/shared/validators";
import {
	createGenAI,
	GEMINI_CHAT_MODEL,
	getGeminiBaseUrl,
	parseVoiceIntent as parseGemini,
} from "./gemini";
import type { TimeAnchor } from "./intent-shared";
import { createOpenAIClient, parseVoiceIntent as parseOpenAI } from "./openai";

/**
 * 语音意图解析所需的 env 子集。鸭子类型 —— 上层把整个 Cloudflare env 传过来即可。
 */
export interface IntentEnv {
	/** 'openai' | 'gemini' | 'auto'；显式值强制对应 provider，'auto'/缺省按来源地区切 */
	AI_PROVIDER?: string;
	GEMINI_API_KEY?: string;
	CF_ACCOUNT_ID?: string;
	CF_AI_GATEWAY_ID?: string;
	OPENAI_API_KEY?: string;
	OPENAI_BASE_URL?: string;
	OPENAI_MODEL?: string;
}

interface ParseArgs {
	userId: string;
	audio: ArrayBuffer;
	audioMimeType: string;
	currentTasks: TaskView[];
	tagCandidates?: string[];
	now: TimeAnchor;
	/** 来源国家/地区码（ISO 3166-1 alpha-2，来自 cf-ipcountry）；auto 模式据此选 provider。 */
	country?: string | null;
}

const CN_REGIONS = new Set(["CN", "HK", "TW", "MO"]);
/** cf-ipcountry 识别不到来源时可能给这些非空但无意义的值：XX=未知，T1=Tor 出口节点。
 *  两者都要按「识别不到来源」处理、回退 MiMo，不能当成已识别的非中国地区发去 Gemini。 */
const UNRESOLVED_REGIONS = new Set(["XX", "T1"]);

/**
 * 选择 AI provider：
 * - AI_PROVIDER 显式为 'openai' / 'gemini' 时强制用它（本地调试 / 手动锁定）。
 * - 'auto' 或未配置时按来源地区切：中国地区（CN/HK/TW/MO）走 OpenCode Go 的 MiMo-V2.6-Flash，
 *   其余已识别地区走 Gemini。识别不到来源时回退 MiMo，避免误发到大陆不可达的 Gemini；
 *   而把大陆用户错发到 Gemini 会直接不可用。
 */
export function pickProvider(
	env: IntentEnv,
	country?: string | null,
): "openai" | "gemini" {
	if (env.AI_PROVIDER === "openai" || env.AI_PROVIDER === "gemini")
		return env.AI_PROVIDER;
	const cc = country?.toUpperCase();
	if (cc && !UNRESOLVED_REGIONS.has(cc) && !CN_REGIONS.has(cc)) return "gemini";
	return "openai";
}

export function getIntentTarget(env: IntentEnv, country?: string | null) {
	const provider = pickProvider(env, country);
	if (provider === "openai") {
		return {
			provider,
			model: env.OPENAI_MODEL,
			endpoint: env.OPENAI_BASE_URL
				? `${env.OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`
				: undefined,
		};
	}
	return {
		provider,
		model: GEMINI_CHAT_MODEL,
		endpoint: `${getGeminiBaseUrl({ gatewayAccountId: env.CF_ACCOUNT_ID, gatewayId: env.CF_AI_GATEWAY_ID }) ?? "https://generativelanguage.googleapis.com"}/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent`,
	};
}

/**
 * 选 provider 并调用对应的 parseVoiceIntent。provider 由 pickProvider 决定
 * （AI_PROVIDER 显式覆盖，否则按来源地区切；详见 pickProvider 注释）。
 */
export async function resolveAndParseVoiceIntent(
	env: IntentEnv,
	args: ParseArgs,
): Promise<Utterance> {
	const { country, userId, ...parseArgs } = args;
	const provider = pickProvider(env, country);
	if (provider === "openai") {
		if (!env.OPENAI_API_KEY || !env.OPENAI_BASE_URL || !env.OPENAI_MODEL) {
			throw new Error(
				"OpenAI 兼容端点需要 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL",
			);
		}
		const client = createOpenAIClient({
			apiKey: env.OPENAI_API_KEY,
			baseURL: env.OPENAI_BASE_URL,
			sessionId: userId,
		});
		return parseOpenAI({ client, model: env.OPENAI_MODEL, ...parseArgs });
	}

	if (!env.GEMINI_API_KEY) {
		throw new Error("GEMINI_API_KEY 未配置");
	}
	const genai = createGenAI({
		apiKey: env.GEMINI_API_KEY,
		gatewayAccountId: env.CF_ACCOUNT_ID,
		gatewayId: env.CF_AI_GATEWAY_ID,
	});
	return parseGemini({ genai, ...parseArgs });
}
