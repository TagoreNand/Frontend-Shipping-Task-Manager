import { expect, test } from '@playwright/test';

test.describe('Logistics board', () => {
  test('renders header, lanes and seeded tasks', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Logistics Control Tower' })).toBeVisible();
    for (const lane of ['Backlog lane', 'In Progress lane', 'Complete lane']) {
      await expect(page.getByRole('region', { name: lane })).toBeVisible();
    }
    await expect(page.getByText('OCN-1042')).toBeVisible();
  });

  test('filters tasks by search query', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Search tasks').fill('AIR-2207');
    await expect(page.getByText('AIR-2207')).toBeVisible();
    await expect(page.getByText('OCN-1042')).toHaveCount(0);
  });
});
