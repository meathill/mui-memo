import { buildUtterance, expect, test } from "./fixtures";

test.describe("输入记录", () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  test("每条 intent 都写一条记录，按倒序展示；点击跳详情", async ({
    inject,
    page,
  }) => {
    // 1 条 ADD
    const addRes = await inject(
      buildUtterance({
        raw: "记得给老妈买点水果",
        intent: "ADD",
        aiVerb: "新增",
        task: { text: "给老妈买水果", place: "out", window: "today" },
      }),
    );
    const addedId = (addRes.effect as { id?: string }).id as string;

    // 1 条 DONE（命中上面那条）
    await inject(
      buildUtterance({
        raw: "水果买了",
        intent: "DONE",
        match: "买水果",
        aiVerb: "已完成",
      }),
    );

    // 1 条 miss（匹配不到的 DONE）
    await inject(
      buildUtterance({
        raw: "这句话对不上任何任务",
        intent: "DONE",
        match: "绝对对不上的关键词",
        aiVerb: "已完成",
      }),
    );

    await page.goto("/profile/log");

    // 限定在 main 里的 li，避免 BottomNav 的 li 干扰
    const items = page.locator("main ul > li");
    await expect(items).toHaveCount(3);

    // 三条都应当在页面上能找到对应特征；不依赖顺序（createdAt 秒精度可能打平）
    await expect(items.filter({ hasText: "未命中清单" })).toHaveCount(1);
    await expect(items.filter({ hasText: "水果买了" })).toHaveCount(1);
    const addItem = items.filter({ hasText: "记得给老妈买点水果" });
    await expect(addItem).toHaveCount(1);

    // ADD 记录可点击 → 跳任务详情
    await addItem.getByRole("link", { name: /查看任务/ }).click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${addedId}$`));
  });

  test("Profile 页的「输入记录」链接会跳到 /profile/log", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("link", { name: "输入记录" }).click();
    await expect(page).toHaveURL(/\/profile\/log$/);
    await expect(page.getByText("MuiMemo · 输入记录")).toBeVisible();
  });
});
