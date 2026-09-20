import { test, expect } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';
test('Galaxy astrology opt-in, disclaimer, sign filter and full profile', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await loginSynthetic(page, 1);
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  await page.getByRole('tab', { name: 'Connect', exact: true }).click();
  await page
    .getByRole('button', { name: /Star Connection Explore signs/ })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('not a scientifically validated measure');
  await expect(dialog.getByLabel('Explore zodiac sign')).toHaveCount(0);
  await dialog.getByRole('checkbox').check();
  await expect(
    dialog.locator('.astrology-people article').first(),
  ).toBeVisible();
  const first = dialog.locator('.astrology-people article').first();
  await expect(first).toContainText('Chart 1:');
  await expect(first).toContainText('Chart 2:');
  await dialog.getByLabel('Explore zodiac sign').selectOption('Leo');
  const rows = dialog.locator('.astrology-people article');
  for (const row of await rows.all())
    await expect(row.locator('strong')).toContainText('Leo');
  await dialog.getByLabel('Explore zodiac sign').selectOption('all');
  await info.attach('astrology-mobile', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await dialog
    .getByRole('button', { name: /View profile/ })
    .first()
    .click();
  await expect(page.locator('.profile-sheet')).toBeVisible();
});
