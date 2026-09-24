import { expect, type Page } from '@playwright/test';

export async function loginSynthetic(page: Page, number: number) {
  await page.goto('/');
  const welcomeLogin = page.getByRole('button', { name: 'Login', exact: true });
  await welcomeLogin.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  if (await welcomeLogin.isVisible().catch(() => false)) await welcomeLogin.click();
  await page
    .getByLabel('Test profile')
    .selectOption(`test${String(number).padStart(3, '0')}@spikedate.test`);
  await page.getByRole('button', { name: /Fill selected test login/i }).click();
  await page.getByRole('button', { name: 'Sign in to SpikeDate' }).click();
  await expect(
    page.getByRole('button', { name: 'Profile', exact: true }),
  ).toBeVisible();
  for (const name of [/^Dismiss /i, /^Later$/, /^Maybe later$/]) {
    const button = page.getByRole('button', { name }).first();
    if (await button.isVisible().catch(() => false)) await button.click();
  }
}
