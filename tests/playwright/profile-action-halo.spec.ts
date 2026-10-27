import { expect, test, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.skip(({ baseURL }) => baseURL !== 'http://127.0.0.1:3007', 'Local fictional fixtures only.');

test('Hairline Halo is consistent on Home, full profile and Galaxy', async ({ page }, info) => {
  const credentials = JSON.parse(readFileSync('outputs/qa/profile-import/login.json', 'utf8'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in to SpikeDate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Home tools' })).toBeVisible({ timeout: 30_000 });
  for (const name of [/^Dismiss /i, /^Later$/, /^Maybe later$/]) {
    const button = page.getByRole('button', { name }).first();
    if (await button.isVisible()) await button.click();
  }
  async function checkControls(scope: Locator, count: number) {
    const buttons = scope.locator('button.profile-action-control');
    await expect(buttons).toHaveCount(count);
    for (const button of await buttons.all()) {
      await expect(button).toBeVisible();
      await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(button).toHaveCSS('border-top-width', '1px');
      await expect(button).toHaveCSS('width', '48px');
      await expect(button).toHaveCSS('height', '48px');
    }
    const like = scope.locator('button.profile-action-control.like');
    await expect(like).toHaveCSS('color', 'rgb(255, 75, 50)');
    await expect(like.locator('svg.lucide-heart')).toHaveCount(1);
    await expect(like.locator('svg')).toHaveCount(1);
    await expect(like.locator('svg')).toHaveCSS('width', '24px');
    await expect(like.locator('svg')).toHaveCSS('stroke-width', '1.8px');
    await expect(scope.locator('.profile-action-control .brand-heart-mark')).toHaveCount(0);
    return like.locator('path').getAttribute('d');
  }
  const home = page.locator('.quiet-rail-home').first();
  const heart = await checkControls(home, 4);
  await info.attach('home-hairline-halo', { body: await page.screenshot(), contentType: 'image/png' });
  await home.locator('.profile-card-open').click();
  await expect(page.getByRole('button', { name: 'Close full profile' })).toBeVisible();
  const actions = page.locator('.sheet-actions').last();
  expect(await checkControls(actions, 4)).toBe(heart);
  await info.attach('full-profile-hairline-halo', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Close full profile' }).click();
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Galaxy', exact: true }).click();
  await page.locator('.room-tile').filter({ has: page.locator('strong', { hasText: /^Music$/ }) }).click();
  const room = page.locator('.photo-first-room');
  await expect(room).toBeVisible();
  expect(await checkControls(room, 3)).toBe(heart);
  await info.attach('galaxy-hairline-halo', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Back to Galaxy', exact: true }).click();
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Spike', exact: true }).click();
  // Observe the real Like handler without creating a relationship during a visual test.
  await page.route('**/api/interactions', async route => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 503, json: { error: 'Visual test: interaction not submitted.' } });
    else await route.continue();
  });
  const request = page.waitForRequest(r => r.url().endsWith('/api/interactions') && r.method() === 'POST');
  await home.locator('button.profile-action-control.like').click();
  expect((await request).postDataJSON().kind).toBe('like');
});
