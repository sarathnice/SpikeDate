import { expect, test } from '@playwright/test';

test.skip(
  ({ baseURL }) => !['3007', '3012'].includes(new URL(baseURL!).port),
  'Local synthetic profiles only.',
);

test('No Spike photo overlays on home, full profile, own profile or preview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByLabel('Test profile').selectOption('atlanta001@spikedate.test');
  await page.getByRole('button', { name: /Fill selected test login/i }).click();
  await page.getByRole('button', { name: 'Sign in to SpikeDate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Home tools', exact: true })).toBeVisible();
  for (const name of [/^Dismiss /i, /^Later$/, /^Maybe later$/]) {
    const button=page.getByRole('button', { name }).first();
    if(await button.isVisible()) await button.click();
  }
  const red = 'rgb(255, 75, 50)';
  await expect(page.locator('.tabbar .tab-brand-symbol')).toHaveCSS('color', red);
  await expect(page.locator('.quiet-rail-home')).toBeVisible();
  await expect(page.locator('.profile-photo-brand')).toHaveCount(0);

  await page.locator('.profile-card-open').click();
  await expect(page.getByRole('button', { name: 'Close full profile' })).toBeVisible();
  await expect(page.locator('.profile-film .profile-photo-brand')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close full profile' }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('.profile-passport-hero')).toBeVisible();
  await expect(page.locator('.profile-passport-hero .profile-photo-brand')).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview my profile card', exact: true }).click();
  await expect(page.locator('.preview-screen')).toBeVisible();
  await expect(page.locator('.profile-photo-brand')).toHaveCount(0);
});
