import { expect, test } from "./fixtures";

test.describe("Onboarding 流程", () => {
  test("Profile 页的「再看一次入门引导」按钮会回到 /onboarding 并可完成", async ({
    page,
  }) => {
    await page.goto("/app/profile");
    await page.getByRole("button", { name: "再看一次入门引导" }).click();
    await page.waitForURL(/\/onboarding$/, { timeout: 10_000 });
    await expect(page.getByText("说一句话，记一件事")).toBeVisible();

    // 点「下一步」到最后一屏
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: "下一步" }).click();
    }
    await page.getByRole("button", { name: "开始使用" }).click();
    await page.waitForURL(/\/app$/, { timeout: 10_000 });
    await expect(page.getByText("MuiMemo · 今天")).toBeVisible();
  });

  test("顶部「跳过」直接回到 Today", async ({ page }) => {
    await page.goto("/onboarding");
    await page.getByRole("button", { name: "跳过" }).click();
    await page.waitForURL(/\/app$/, { timeout: 10_000 });
    await expect(page.getByText("MuiMemo · 今天")).toBeVisible();
  });
});
