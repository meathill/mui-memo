/**
 * @vitest-environment node
 *
 * pickProvider 纯逻辑单测：覆盖 AI_PROVIDER 显式覆盖与 auto 模式的地区切换。
 * 用 node 环境，避免 happy-dom 注入 window 触发 OpenAI SDK 的浏览器保护
 *（intent.ts 会间接 import openai / @google/genai）。
 */
import { describe, expect, it } from 'vitest';
import { type IntentEnv, pickProvider } from './intent';

const base: IntentEnv = {
  GEMINI_API_KEY: 'g',
  OPENAI_API_KEY: 'o',
  OPENAI_BASE_URL: 'https://example/v1',
  OPENAI_MODEL: 'm',
};

describe('pickProvider', () => {
  it('AI_PROVIDER 显式值强制覆盖地区', () => {
    expect(pickProvider({ ...base, AI_PROVIDER: 'openai' }, 'US')).toBe('openai');
    expect(pickProvider({ ...base, AI_PROVIDER: 'gemini' }, 'CN')).toBe('gemini');
  });

  it('auto：中国地区(CN/HK/TW/MO) → openai', () => {
    for (const cc of ['CN', 'HK', 'TW', 'MO']) {
      expect(pickProvider({ ...base, AI_PROVIDER: 'auto' }, cc)).toBe('openai');
    }
  });

  it('auto：其余已识别地区 → gemini', () => {
    for (const cc of ['US', 'JP', 'GB', 'SG']) {
      expect(pickProvider({ ...base, AI_PROVIDER: 'auto' }, cc)).toBe('gemini');
    }
  });

  it('auto：识别不到来源(null/undefined/空串/未知) → 回退 openai', () => {
    expect(pickProvider({ ...base, AI_PROVIDER: 'auto' }, null)).toBe('openai');
    expect(pickProvider({ ...base, AI_PROVIDER: 'auto' }, undefined)).toBe('openai');
    expect(pickProvider({ ...base, AI_PROVIDER: 'auto' }, '')).toBe('openai');
  });

  it('缺省（未配置 AI_PROVIDER）等价 auto', () => {
    expect(pickProvider(base, 'US')).toBe('gemini');
    expect(pickProvider(base, 'CN')).toBe('openai');
    expect(pickProvider(base, null)).toBe('openai');
  });

  it('地区码大小写不敏感', () => {
    expect(pickProvider({ ...base, AI_PROVIDER: 'auto' }, 'cn')).toBe('openai');
    expect(pickProvider({ ...base, AI_PROVIDER: 'auto' }, 'us')).toBe('gemini');
  });
});
