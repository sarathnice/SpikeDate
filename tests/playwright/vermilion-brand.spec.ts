import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test.skip(
  ({ baseURL }) => !['3007', '3012'].includes(new URL(baseURL!).port),
  'Local synthetic profiles only.',
);

test('Vermilion identity is consistent on mobile home, full profile, and my profile', async ({ page }) => {
  await loginSynthetic(page, 1);
  const red = 'rgb(255, 75, 50)';
  await expect(page.locator('.brand-wordmark .brand-symbol')).toHaveCSS('color', red);
  await expect(page.locator('.tabbar .tab-brand-symbol')).toHaveCSS('color', red);
  await expect(page.locator('.profile-card > .profile-photo-brand')).toBeVisible();
  await expect(page.locator('.profile-card > .profile-photo-brand svg')).toHaveCSS('color', red);

  await page.locator('.profile-card-open').click();
  await expect(page.locator('.profile-film .profile-photo-brand')).toBeVisible();
  await page.getByRole('button', { name: 'Close full profile' }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('.profile-passport-hero .profile-photo-brand')).toBeVisible();
  await expect(page.locator('.profile-passport-hero .profile-photo-brand svg')).toHaveCSS('color', red);
});
