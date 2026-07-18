import { buildUtterance, expect, test } from "./fixtures";

test.describe("Today 页", () => {
  test.beforeEach(async ({ resetTasks, page }) => {
    await resetTasks();
    await page.goto("/app");
  });

  test("ADD 意图注入后任务出现在「此刻可做」桶", async ({ inject, page }) => {
    await inject(
      buildUtterance({
        raw: "下午三点前给老张转五百",
        intent: "ADD",
        aiVerb: "新增",
        aiReason: "硬截止 · 高优先",
        task: {
          text: "给老张转五百",
          place: "any",
          window: "now",
          priority: 3,
          tag: "财务",
          deadline: "15:00",
        },
      }),
      "home",
    );
    await page.reload();

    await expect(page.getByText("此刻可做")).toBeVisible();
    await expect(page.getByText("给老张转五百").first()).toBeVisible();
    // 场景条的计数至少 >= 1
    await expect(page.getByText(/此刻能做\s*\d+\s*件/)).toContainText(/[1-9]/);
  });

  test("STATUS 意图把任务切到「正在做」卡片", async ({ inject, page }) => {
    await inject(
      buildUtterance({
        raw: "ADD 招行任务",
        intent: "ADD",
        aiVerb: "新增",
        task: {
          text: "招行转账确认",
          place: "any",
          window: "today",
          priority: 2,
        },
      }),
    );
    await page.reload();
    await expect(page.getByText("招行转账确认").first()).toBeVisible();

    await inject(
      buildUtterance({
        raw: "我现在去银行",
        intent: "STATUS",
        match: "招行",
        aiVerb: "开始做",
        patch: { status: "doing" },
      }),
    );
    await page.reload();

    // doing 卡片有专属的「正在做」标签
    await expect(page.getByText("正在做").first()).toBeVisible();
    await expect(page.getByText("招行转账确认")).toBeVisible();
  });

  test("DONE 意图把任务勾掉，清单里消失", async ({ inject, page }) => {
    await inject(
      buildUtterance({
        raw: "ADD 带水",
        intent: "ADD",
        aiVerb: "新增",
        task: { text: "带水", place: "out", window: "today" },
      }),
    );
    await page.reload();
    await expect(page.getByText("带水").first()).toBeVisible();

    // 注册 dialog 处理器，点击确认完成
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("确认完成任务「带水」？");
      await dialog.accept();
    });

    await inject(
      buildUtterance({
        raw: "水买了",
        intent: "DONE",
        match: "带水",
        aiVerb: "已完成",
      }),
    );
    await page.reload();

    // 已完成的任务不再出现在 Today 清单
    await expect(page.getByText("带水")).toHaveCount(0);
  });

  test("已完成任务不会在下一次语音处理响应里重新出现", async ({
    inject,
    page,
  }) => {
    const added = await inject(
      buildUtterance({
        raw: "ADD 回归测试专用任务A",
        intent: "ADD",
        aiVerb: "新增",
        task: { text: "回归测试专用任务A", place: "any", window: "today" },
      }),
    );
    const taskAId = added.effect.id;

    await inject(
      buildUtterance({
        raw: "回归测试专用任务A搞定了",
        intent: "DONE",
        match: "回归测试专用任务A",
        aiVerb: "已完成",
      }),
    );

    const afterDone = await inject(
      buildUtterance({
        raw: "ADD 回归测试专用任务B",
        intent: "ADD",
        aiVerb: "新增",
        task: { text: "回归测试专用任务B", place: "any", window: "today" },
      }),
    );

    // 已完成的任务A不该出现在这次响应的 tasks 里（本地缓存会被这份数据整表覆盖）
    expect(afterDone.tasks.some((t) => t.id === taskAId)).toBe(false);
    expect(afterDone.tasks.some((t) => t.text === "回归测试专用任务B")).toBe(
      true,
    );

    await page.reload();
    await expect(page.getByText("回归测试专用任务A")).toHaveCount(0);
    await expect(
      page.getByText("回归测试专用任务B").first(),
    ).toBeVisible();
  });

  test("场景切换改变当前可做计数", async ({ inject, page }) => {
    await inject(
      buildUtterance({
        raw: "ADD 浇花",
        intent: "ADD",
        aiVerb: "新增",
        task: {
          text: "给花浇水",
          place: "home",
          window: "today",
          priority: 2,
        },
      }),
    );
    await page.reload();

    await page.getByRole("button", { name: /在家/ }).click();
    await expect(page.getByText(/今天\s·\s这里/)).toBeVisible();

    await page.getByRole("button", { name: /工位/ }).click();
    // 「给花浇水」place=home，工位场景应落入 today_else
    await expect(page.getByText(/今天\s·\s别处/)).toBeVisible();
  });
});
