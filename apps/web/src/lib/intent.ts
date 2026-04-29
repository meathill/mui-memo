import type { TaskView } from '@mui-memo/shared/logic';
import type { Utterance } from '@mui-memo/shared/validators';
import { createGenAI, parseVoiceIntent as parseGemini } from './gemini';
import type { TimeAnchor } from './intent-shared';
import { createOpenAIClient, parseVoiceIntent as parseOpenAI } from './openai';

/**
 * 语音意图解析所需的 env 子集。鸭子类型 —— 上层把整个 Cloudflare env 传过来即可。
 */
export interface IntentEnv {
  /** 'openai' | 'gemini'；缺省走 gemini */
  AI_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  CF_ACCOUNT_ID?: string;
  CF_AI_GATEWAY_ID?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
}

interface ParseArgs {
  audio: ArrayBuffer;
  audioMimeType: string;
  currentTasks: TaskView[];
  now: TimeAnchor;
}

/**
 * 根据 env.AI_PROVIDER 选择 provider，调用对应的 parseVoiceIntent。
 * 默认 gemini，传 'openai' 走 OpenAI 兼容端点（默认目标是 MIMO）。
 */
export async function resolveAndParseVoiceIntent(env: IntentEnv, args: ParseArgs): Promise<Utterance> {
  if (env.AI_PROVIDER === 'openai') {
    if (!env.OPENAI_API_KEY || !env.OPENAI_BASE_URL || !env.OPENAI_MODEL) {
      throw new Error('AI_PROVIDER=openai 需要 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL');
    }
    const client = createOpenAIClient({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    });
    return parseOpenAI({ client, model: env.OPENAI_MODEL, ...args });
  }

  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY 未配置');
  }
  const genai = createGenAI({
    apiKey: env.GEMINI_API_KEY,
    gatewayAccountId: env.CF_ACCOUNT_ID,
    gatewayId: env.CF_AI_GATEWAY_ID,
  });
  return parseGemini({ genai, ...args });
}
