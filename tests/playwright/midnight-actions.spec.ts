import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

const midnightRed = 'rgb(227, 27, 54)';

test('Midnight registration, filter and profile actions use solid red', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('pulse-theme', 'default'));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Send code' })).toHaveCSS(
    'background-color',
    midnightRed,
  );

  await loginSynthetic(page, 11);
  await page.getByRole('button', { name: /Filter/i }).first().click();
  await expect(page.locator('.filter-dialog .apply-filters')).toHaveCSS(
    'background-color',
    midnightRed,
  );
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page
    .getByRole('button', { name: 'Edit relationship goals', exact: true })
    .click();
  await expect(
    page.locator('.registration-dialog').getByRole('button', {
      name: 'Save changes',
    }),
  ).toHaveCSS('background-color', midnightRed);
});

test('Midnight Galaxy reminder and Send Spike actions use solid red', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('pulse-theme', 'default'));
  await loginSynthetic(page, 24);
  await page
    .getByRole('button', { name: /Send .* a Spike introduction/ })
    .click();
  await expect(
    page.locator('.spike-focused-sheet').getByRole('button', {
      name: 'Send Spike',
      exact: true,
    }),
  ).toHaveCSS('background-color', midnightRed);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  const settings = page.locator('.engagement-settings-card');
  await settings.locator(':scope > summary').click();
  await settings.locator('.reminder-preview-disclosure > summary').click();
  const switcher = settings.getByRole('group', {
    name: 'Choose reminder preview',
  });
  const action = settings.locator(
    '.reminder-preview-card .engagement-prompt-actions .primary',
  );
  for (const reminder of ['Today', 'Galaxy', 'Spike', 'Lift']) {
    await switcher.getByRole('button', { name: reminder, exact: true }).click();
    await expect(action).toHaveCSS('background-color', midnightRed);
  }
});
