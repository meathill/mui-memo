import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import {
  E2E_EMAIL,
  E2E_EMAIL_PATTERN,
  E2E_NAME,
  E2E_PASSWORD,
  callCleanup,
} from "./fixtures";

const AUTH_FILE = path.resolve("./e2e/.auth/user.json");

setup("register e2e user and save storage", async ({ page, request }) => {
  // 先把以前遗留的 e2e 账号全部清掉（pattern 匹配）
  await callCleanup(request, E2E_EMAIL_PATTERN, "user");

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[browser error]", msg.text());
  });
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));

  await page.goto("/register");
  await page.getByLabel("昵称").fill(E2E_NAME);
  await page.getByLabel("邮箱").fill(E2E_EMAIL);
  await page.getByLabel("密码（≥ 8 位）").fill(E2E_PASSWORD);

  // 监听 sign-up 接口响应，失败时直接报错
  const signUpPromise = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/sign-up") &&
      res.request().method() === "POST",
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: "注册" }).click();
  const signUpRes = await signUpPromise;
  expect(
    signUpRes.status(),
    `sign-up failed: ${await signUpRes.text().catch(() => "")}`,
  ).toBeLessThan(400);

  // 注册成功后会跳 /，Today 首次加载触发 onboarding 跳转
  await page.waitForURL(/\/(onboarding)?$/, { timeout: 30_000 });

  // 如果跳到 onboarding，走完 5 步
  if (page.url().endsWith("/onboarding")) {
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: "下一步" }).click();
    }
    await page.getByRole("button", { name: "开始使用" }).click();
    await page.waitForURL(/\/$/, { timeout: 10_000 });
  }

  // 再次确认落在 Today
  await expect(page.getByText("MuiMemo · 今天")).toBeVisible();

  // 显式写入 onboarded 标记，避免捕获 storageState 时拿不到 localStorage
  await page.evaluate(() =>
    window.localStorage.setItem("muimemo:onboarded", "1"),
  );

  // 持久化 cookies + localStorage 到 storage state
  await page.context().storageState({ path: AUTH_FILE });
});
