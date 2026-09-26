import { expect, test, type Page } from '@playwright/test';

function section(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: new RegExp(`^${name}(?:\\s|$)`) });
}

test('staff reviews local pending media, both appeal outcomes, and restricted case evidence', async ({ page }) => {
  test.skip(process.env.SPIKEDATE_ADMIN_MUTATION_TESTS !== '1' || !process.env.SPIKEDATE_UI_URL?.startsWith('http://127.0.0.1:'), 'Requires explicit opt-in and local synthetic media/appeal fixtures.');
  await page.goto('/admin');
  await page.getByLabel('Email address').fill('test001@spikedate.test');
  await page.getByLabel('Password').fill('SpikeDate2026!');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

  await section(page, 'Media').click();
  const media = page.locator('.admin-media-item').filter({ hasText: 'Lena' });
  await expect(media).toBeVisible();
  await media.getByRole('button', { name: 'Review' }).click();
  await media.getByLabel('Decision note · required').fill('Synthetic local media review approved.');
  await media.getByRole('button', { name: 'Approve' }).click();
  await expect(media).toHaveCount(0);

  await section(page, 'Appeals').click();
  for (const [statement, decision, status] of [
    ['Synthetic appeal to uphold', 'Uphold decision', 'upheld'],
    ['Synthetic appeal to overturn', 'Overturn decision', 'overturned'],
  ]) {
    const appeal = page.locator('.admin-panel .admin-item').filter({ hasText: statement });
    await expect(appeal).toBeVisible();
    await appeal.getByRole('button', { name: 'Review' }).click();
    await appeal.getByLabel('Decision note · required').fill(`Synthetic local appeal review: ${status}.`);
    await appeal.getByRole('button', { name: decision }).click();
    await expect(appeal.getByText(status, { exact: true })).toBeVisible();
  }

  await section(page, 'People').click();
  await page.getByLabel('Find a person or ask a question').fill('test003@spikedate.test');
  await page.getByRole('button', { name: 'Search people' }).click();
  await page.locator('.admin-people-directory .admin-item').filter({ hasText: 'test003@spikedate.test' }).getByRole('button', { name: 'Open account' }).click();
  await expect(page.getByText('Account record', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Account details' }).getByRole('button', { name: 'Safety' }).click();
  const evidenceButton = page.getByRole('button', { name: 'View case messages' }).first();
  await expect(evidenceButton).toBeDisabled();
  await page.getByPlaceholder('Required for each evidence request; at least 10 characters').fill('Reviewing synthetic local report evidence.');
  await evidenceButton.click();
  await expect(page.getByRole('heading', { name: /Case message evidence/ })).toBeVisible();
  await page.getByRole('button', { name: 'Close evidence' }).click();
  await expect(page.getByRole('heading', { name: /Case message evidence/ })).toHaveCount(0);

  await section(page, 'Activity').click();
  await expect(page.locator('.admin-audit-item').filter({ hasText: 'moderation.appeal' }).first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
