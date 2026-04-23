import { buildUtterance, expect, test } from './fixtures';

test.describe('全部 (按 tag 分组)', () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  test('不同 tag 的任务会被分到各自的组里', async ({ inject, page }) => {
    await inject(
      buildUtterance({
        raw: 'ADD 回邮件',
        intent: 'ADD',
        aiVerb: '新增',
        task: { text: '回李总邮件', tag: '工作', place: 'work' },
      }),
    );
    await inject(
      buildUtterance({
        raw: 'ADD 交物业',
        intent: 'ADD',
        aiVerb: '新增',
        task: { text: '交物业费', tag: '财务' },
      }),
    );
    await inject(
      buildUtterance({
        raw: 'ADD 给花',
        intent: 'ADD',
        aiVerb: '新增',
        task: { text: '给花浇水', tag: '家务', place: 'home' },
      }),
    );

    await page.goto('/app/all');
    await expect(page.getByText('共 3 件待办，按标签分组')).toBeVisible();
    // tag 分组标题是 h2
    await expect(page.getByRole('heading', { name: '工作' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '财务' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '家务' })).toBeVisible();
    await expect(page.getByText('回李总邮件')).toBeVisible();
    await expect(page.getByText('交物业费')).toBeVisible();
    await expect(page.getByText('给花浇水')).toBeVisible();
  });
});
