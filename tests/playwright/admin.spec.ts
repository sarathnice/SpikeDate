import { expect, test } from '@playwright/test';

test('dedicated admin sign-in opens the protected workspace on mobile', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page.getByLabel('Email address').fill('test001@spikedate.test');
  await page.getByLabel('Password').fill('SpikeDate2026!');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByText('Active accounts', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'People' }).click();
  await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'All people' })).toBeVisible();
  await expect(page.getByText(/total accounts · .* match current filters/)).toBeVisible();
  const next = page.getByRole('button', { name: 'Next' });
  if (await next.isEnabled()) {
    await next.click();
    await expect(page.getByText(/page 2 of/)).toBeVisible();
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(page.getByText(/page 1 of/)).toBeVisible();
  }
  await page.getByLabel('Find a person or ask a question').fill('How many people?');
  await page.getByRole('button', { name: 'Ask about this' }).click();
  await expect(page.getByText(/total accounts in SpikeDate/)).toBeVisible();
  await page.getByLabel('Find a person or ask a question').fill('test002@spikedate.test');
  await page.getByRole('button', { name: 'Ask about this' }).click();
  await expect(page.locator('.admin-directory-answer').getByRole('button')).toBeVisible();
  await page.getByRole('button', { name: 'Search people' }).click();
  await expect(page.getByText('test002@spikedate.test', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Open account' }).first().click();
  await expect(page.getByText('Account record', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Photos & verification' }).click();
  await expect(page.getByText('The live-camera frame is not retained', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Billing' }).click();
  await expect(page.getByText('Store subscriptions are read-only', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Activity' }).click();
  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('ordinary account cannot enter the admin workspace', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', {
    data: { email: 'test002@spikedate.test', password: 'SpikeDate2026!' },
  });
  expect(login.ok()).toBe(true);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Staff access required' })).toBeVisible();
  const operations = await page.request.get('/api/admin/operations?view=users');
  expect(operations.status()).toBe(403);
  const suspension = await page.request.patch('/api/admin/users/test-003', {
    data: { action: 'suspend', note: 'Unauthorized action should be rejected.' },
  });
  expect(suspension.status()).toBe(403);
});
