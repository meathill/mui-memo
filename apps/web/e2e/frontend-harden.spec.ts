import { buildUtterance, expect, test } from "./fixtures";

test.describe("Today · 内存筛选", () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  test("切换场景不触发新的 /api/tasks 请求", async ({ inject, page }) => {
    await inject(
      buildUtterance({
        raw: "ADD",
        intent: "ADD",
        aiVerb: "新增",
        task: {
          text: "给花浇水",
          place: "home",
          window: "today",
        },
      }),
    );

    // 首次进入 Today，拉一次 /api/tasks
    let tasksCalls = 0;
    page.on("request", (req) => {
      const url = req.url();
      if (url.endsWith("/api/tasks") || url.includes("/api/tasks?")) {
        tasksCalls++;
      }
    });

    await page.goto("/");
    await expect(page.getByText("给花浇水")).toBeVisible();

    // 记录当前计数作为基线
    const baseline = tasksCalls;

    // 切场景三次
    await page.getByRole("button", { name: /在公司/ }).click();
    await page.getByRole("button", { name: /在外/ }).click();
    await page.getByRole("button", { name: /在家/ }).click();

    // 给浏览器一点时间（如果真有多余请求会发出）
    await page.waitForTimeout(500);
    expect(tasksCalls).toBe(baseline);
  });

  test("手动刷新按钮重新拉 /api/tasks", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    let tasksCalls = 0;
    page.on("request", (req) => {
      if (req.url().endsWith("/api/tasks")) tasksCalls++;
    });
    await page.getByTestId("manual-refresh").first().click();
    await expect.poll(() => tasksCalls).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Completed · 分页", () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  test("limit=2 + nextCursor 正确翻页", async ({ inject, page }) => {
    // 先造 3 条 done 任务（时间戳递增）
    for (const n of [1, 2, 3]) {
      await inject(
        buildUtterance({
          raw: `ADD-${n}`,
          intent: "ADD",
          aiVerb: "新增",
          task: { text: `任务 ${n}`, place: "any", window: "today" },
        }),
      );
    }
    // 登录后 cookie 就绪，直接打 API 把它们都 mark done
    const listRes = await page.request.get("/api/tasks");
    const { tasks } = (await listRes.json()) as {
      tasks: Array<{ id: string }>;
    };
    for (const t of tasks) {
      await page.request.post(`/api/tasks/${t.id}/done`);
    }

    // 第一页 limit=2 → 2 条 + hasMore=true + nextCursor 非空
    const page1 = await page.request.get("/api/tasks/completed?limit=2");
    const p1 = (await page1.json()) as {
      tasks: Array<{ id: string }>;
      nextCursor: string | null;
      hasMore: boolean;
    };
    expect(p1.tasks.length).toBe(2);
    expect(p1.hasMore).toBe(true);
    expect(p1.nextCursor).not.toBeNull();

    // 第二页拿下一页
    const page2 = await page.request.get(
      `/api/tasks/completed?limit=2&before=${encodeURIComponent(p1.nextCursor!)}`,
    );
    const p2 = (await page2.json()) as {
      tasks: Array<{ id: string }>;
      hasMore: boolean;
    };
    expect(p2.tasks.length).toBe(1);
    expect(p2.hasMore).toBe(false);
  });
});
