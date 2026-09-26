import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test('member asks Help, sends a request, and reads the owner reply', async ({ page }) => {
  test.skip(!process.env.SPIKEDATE_UI_URL?.startsWith('http://127.0.0.1:'), 'This mutating workflow runs only against the local synthetic database.');
  const marker = `Help QA ${Date.now()}`;
  await loginSynthetic(page, 42);
  expect((await page.request.post('/api/auth/login', { data: { email: 'test042@spikedate.test', password: 'SpikeDate2026!' } })).ok()).toBe(true);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: /Help & support/ }).click();
  const help = page.getByRole('dialog', { name: 'SpikeDate Help' });
  await expect(help).toBeVisible();
  await help.getByRole('button', { name: 'New question' }).click();
  await help.getByRole('button', { name: 'Photo verification' }).click();
  await expect(help.getByText(/Your current photo-verification status/)).toBeVisible();
  await help.getByRole('button', { name: 'Need a person? Send to support' }).click();
  await help.getByPlaceholder('Short summary').fill(marker);
  await help.getByRole('button', { name: 'Send to support' }).click();
  await expect(help.getByText(/Sent to SpikeDate support/)).toBeVisible();
  await page.request.post('/api/auth/logout');

  const admin = await page.request.post('/api/auth/login', { data: { email: 'test001@spikedate.test', password: 'SpikeDate2026!' } });
  expect(admin.ok()).toBe(true);
  await page.goto('/admin');
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Support' }).click();
  const ticket = page.locator('.admin-support-list button').filter({ hasText: marker });
  await expect(ticket).toBeVisible();
  await ticket.click();
  await page.getByLabel('Reply to member').fill(`${marker}: Your photo status was checked.`);
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(page.getByText(`${marker}: Your photo status was checked.`)).toBeVisible();
  await page.request.post('/api/auth/logout');

  expect((await page.request.post('/api/auth/login', { data: { email: 'test042@spikedate.test', password: 'SpikeDate2026!' } })).ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: /Help & support/ }).click();
  await expect(page.getByRole('dialog', { name: 'SpikeDate Help' }).getByText(`${marker}: Your photo status was checked.`)).toBeVisible();
});
