import { buildUtterance, expect, test } from "./fixtures";

test.describe("任务完成链路", () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  test("手动勾选 → Today 消失 → Completed 出现 → Profile 统计增加", async ({
    inject,
    page,
  }) => {
    await inject(
      buildUtterance({
        raw: "ADD 寄快递",
        intent: "ADD",
        aiVerb: "新增",
        task: {
          text: "寄快递给妈妈",
          place: "out",
          window: "today",
          tag: "家务",
        },
      }),
    );

    await page.goto("/app");
    const row = page.getByText("寄快递给妈妈").first();
    await expect(row).toBeVisible();

    // 点击任务行左边的圆形勾，同时等服务端 done POST 回来
    const donePromise = page.waitForResponse(
      (r) =>
        /\/api\/tasks\/[^/]+\/done$/.test(r.url()) &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "标记为完成" }).first().click();
    await donePromise;

    // 乐观更新：Today 里那条任务立刻消失
    await expect(page.getByText("寄快递给妈妈")).toHaveCount(0, {
      timeout: 10_000,
    });

    await page.goto("/app/completed");
    await expect(page.getByText(/已加载 1 件/)).toBeVisible();
    await expect(page.getByText("寄快递给妈妈")).toBeVisible();
    // "今天" 分组头：限定在 h2（避免与 BottomNav 的 Today 标签冲突）
    await expect(page.locator("h2", { hasText: "今天" })).toBeVisible();

    await page.goto("/app/profile");
    // StatCard 的「累计完成」至少显示 1
    const done = page.getByText("累计完成").locator("..");
    await expect(done).toContainText(/[1-9]/);
    const doneToday = page.getByText("今日已勾").locator("..");
    await expect(doneToday).toContainText(/[1-9]/);
  });
});
