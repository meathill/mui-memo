import type { IntentEffect } from '@mui-memo/shared/logic';
import type { Utterance } from '@mui-memo/shared/validators';
import { type APIRequestContext, test as base, expect } from '@playwright/test';

export interface InjectResult {
  effect: IntentEffect;
}

/**
 * 共享的 e2e 用户 —— 由 auth.setup.ts 注册，所有后续 spec 都复用。
 * 邮箱前缀 e2e+ 方便清理脚本按 pattern 匹配。
 */
export const E2E_EMAIL = 'e2e+fixture@muimemo.test';
export const E2E_PASSWORD = 'e2e-password-1234';
export const E2E_NAME = 'e2e 测试';
export const E2E_EMAIL_PATTERN = 'e2e+%@muimemo.test';

interface Fixtures {
  /** 把 utterance 直接喂进 /api/test-e2e/intent，绕过 Gemini；返回 effect 便于拿到新任务 id。 */
  inject: (utterance: Utterance, place?: string) => Promise<InjectResult>;
  /** 清空当前 e2e 用户的所有任务，保留账号。 */
  resetTasks: () => Promise<void>;
}

export const test = base.extend<Fixtures>({
  // 使用 page.request 而非 request，保证 /api/test-e2e/* 调用带上
  // storageState 里的 Better-Auth cookie，任务归属到当前 e2e 用户。
  inject: async ({ page }, use) => {
    await use(async (utterance, place = 'home') => {
      // skipResolve=true：inject 只创建任务，不触发 hybrid 搜索（测试里 task
      // 刚写入，embedding 可能还在生成），意图匹配走 applyIntent 的正则兜底。
      const res = await page.request.post('/api/test-e2e/intent', {
        data: { utterance, place, skipResolve: true },
      });
      expect(res.status(), await res.text().catch(() => '')).toBe(200);
      return (await res.json()) as InjectResult;
    });
  },
  resetTasks: async ({ page }, use) => {
    await use(async () => {
      const res = await page.request.post('/api/test-e2e/cleanup', {
        data: { email: E2E_EMAIL, mode: 'tasks' },
      });
      expect(res.status()).toBe(200);
    });
  },
});

export { expect } from '@playwright/test';

/**
 * 快速构造一条 Utterance。
 */
export function buildUtterance(override: Partial<Utterance> & Pick<Utterance, 'intent'>): Utterance {
  return {
    raw: '',
    aiReason: '',
    aiVerb: '',
    dims: [],
    ...override,
  };
}

export async function callCleanup(request: APIRequestContext, email: string, mode: 'tasks' | 'user' = 'user') {
  await request.post('/api/test-e2e/cleanup', { data: { email, mode } });
}
