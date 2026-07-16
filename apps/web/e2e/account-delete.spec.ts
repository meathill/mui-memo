import { expect, test } from "@playwright/test";
import { buildUtterance } from "./fixtures";

/**
 * 注销账号（Apple 5.1.1(v)）端到端：注册一次性账号 → 造一条任务 →
 * 调 /api/account/delete → 断言账号与会话被永久删除。
 *
 * 用 playwright.request.newContext 起一个干净上下文，绕开共享 e2e 用户的
 * storageState——这样删的是这个一次性账号，不影响其它 spec 复用的 fixture 用户。
 * 注册一次性邮箱也用 e2e+ 前缀，teardown 的 pattern 清理能兜底捞走。
 */
test.describe("注销账号", () => {
  test("注销后账号与会话被永久删除", async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL });
    const email = `e2e+del-${Date.now()}@muimemo.test`;
    const password = "e2e-password-1234";

    // 1. 注册：同源会种 Better-Auth session cookie，request context 自动保存后续带上
    const signUp = await ctx.post("/api/auth/sign-up/email", {
      data: { email, password, name: "待注销" },
    });
    expect(signUp.status(), await signUp.text().catch(() => "")).toBeLessThan(
      400,
    );

    // 2. 造一条任务，确保注销时级联删除路径真的有数据要删（utterances/tasks/...）
    const inject = await ctx.post("/api/test-e2e/intent", {
      data: {
        utterance: buildUtterance({
          raw: "记得交电费",
          intent: "ADD",
          aiVerb: "新增",
          task: { text: "交电费", place: "home", window: "today" },
        }),
        place: "home",
        skipResolve: true,
      },
    });
    expect(inject.status(), await inject.text().catch(() => "")).toBe(200);

    // 3. 注销
    const del = await ctx.post("/api/account/delete");
    expect(del.status(), await del.text().catch(() => "")).toBe(200);
    expect(await del.json()).toMatchObject({ ok: true });

    // 4. 会话已失效：受保护接口应 401
    const tasksAfter = await ctx.get("/api/tasks");
    expect(tasksAfter.status()).toBe(401);

    // 5. 账号已不存在：同邮箱密码再登录应失败
    const reLogin = await ctx.post("/api/auth/sign-in/email", {
      data: { email, password },
    });
    expect(reLogin.status(), "已注销账号不应能再登录").toBeGreaterThanOrEqual(
      400,
    );

    await ctx.dispose();
  });
});
