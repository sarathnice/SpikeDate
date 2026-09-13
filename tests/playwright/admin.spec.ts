import { expect, test } from '@playwright/test';

test('protected admin dashboard is usable on mobile', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', {
    data: {
      email: 'test001@spikedate.test',
      password: 'SpikeDate2026!',
    },
  });
  expect(login.ok()).toBe(true);

  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Keep every connection safe.' }),
  ).toBeVisible();
  await expect(page.getByText('Active users')).toBeVisible();
  await expect(page.getByText('Open reports', { exact: true })).toBeVisible();
  await expect(page.getByText('Trust & operations')).toBeVisible();
});
