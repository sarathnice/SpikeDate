import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test('Gallery Glass: theme persistence, controls, profile and Spike composer', async ({
  page,
}, info) => {
  test.skip(true, 'Gallery Glass was removed from the five retained themes.');
  test.setTimeout(120000);
  await loginSynthetic(page, info.project.name === 'android-mobile' ? 43 : 42);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: /^App theme/ }).click();
  await page.locator('[data-theme-choice="gallery"]').click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-pulse-theme',
    'gallery',
  );
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute(
    'data-pulse-theme',
    'gallery',
  );
  await page.getByRole('button', { name: 'Spike', exact: true }).click();
  const rail = page.locator('.home-action-rail');
  await expect(rail).toBeVisible();
  await expect(rail.locator('.gallery-like-heart')).toHaveCSS(
    'color',
    'rgb(255, 37, 63)',
  );
  await expect(page.locator('.home-today-tools .today-feed')).toBeVisible();
  const buttons = await rail.locator('button').evaluateAll((elements) =>
    elements.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  expect(buttons).toHaveLength(4);
  expect(buttons[3].y).toBeGreaterThan(buttons[0].y);
  for (const rect of buttons) {
    expect(rect.w).toBeGreaterThanOrEqual(40);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.w).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await info.attach('gallery-home', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await rail.locator('.spark').click();
  const composer = page.locator('.note-dialog');
  await expect(composer).toBeVisible();
  await expect(composer.locator('textarea')).toHaveCSS('font-size', '16px');
  await composer.locator('.note-sheet-close').click();
  await expect(composer).not.toBeVisible();
  await page.locator('.home-today-tools .today-compose').click();
  await expect(page.locator('.today-composer-dialog')).toBeVisible();
  await expect(page.locator('.today-availability-switch')).toBeVisible();
  await page.getByRole('button', { name: 'Close Today composer' }).click();
  await page.locator('.home-today-tools .today-feed').click();
  await expect(page.locator('.today-feed-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close all Today updates' }).click();
  for (const tab of ['Galaxy', 'Likes', 'Chat', 'Profile']) {
    await page
      .locator('.tabbar button')
      .filter({
        has: page.locator('.tab-label').getByText(tab, { exact: true }),
      })
      .click();
    await page.locator('.global-boost-button').click();
    await expect(page.locator('.boost-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close Profile Lift' }).click();
  }
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Preview my profile card' }).click();
  await page
    .getByRole('button', { name: 'Open your full profile preview' })
    .click();
  const full = page.locator('.profile-preview-sheet');
  await expect(full.locator('.profile-title h2')).toHaveCSS(
    'font-size',
    '26px',
  );
  await expect(full.locator('.full-passport-facts strong').first()).toHaveCSS(
    'font-weight',
    '400',
  );
  await full.locator('.full-passport-facts').first().scrollIntoViewIfNeeded();
  await info.attach('gallery-full-profile', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});
