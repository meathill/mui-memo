import { expect, test } from './fixtures';

test.describe('底部导航', () => {
  test('四个标签可相互跳转并高亮', async ({ page }) => {
    await page.goto('/app');
    const nav = page.getByRole('navigation');

    await nav.getByRole('link', { name: '全部' }).click();
    await expect(page).toHaveURL(/\/app\/all$/);
    await expect(page.getByText('MuiMemo · 全部')).toBeVisible();

    await nav.getByRole('link', { name: '已完成' }).click();
    await expect(page).toHaveURL(/\/app\/completed$/);
    await expect(page.getByText('MuiMemo · 已完成')).toBeVisible();

    await nav.getByRole('link', { name: '我的' }).click();
    await expect(page).toHaveURL(/\/app\/profile$/);
    await expect(page.getByText('MuiMemo · 我的')).toBeVisible();

    await nav.getByRole('link', { name: '今天' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText('MuiMemo · 今天')).toBeVisible();
  });
});
