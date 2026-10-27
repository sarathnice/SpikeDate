import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('cinematic Home: one Tools shortcut, five real destinations, transparent rail and safe navigation', async ({ page, baseURL }, info) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const local = !!baseURL && ['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname);
  const credentials = local
    ? JSON.parse(readFileSync('outputs/qa/profile-import/login.json', 'utf8'))
    : { email: 'test001@spikedate.test', password: 'SpikeDate2026!' };
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const login = page.getByRole('button', { name: 'Login', exact: true });
  await login.waitFor({ state: 'visible', timeout: 30_000 });
  await login.click();
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in to SpikeDate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Home tools', exact: true })).toBeVisible({ timeout: 30_000 });
  for (const name of [/^Dismiss /i, /^Later$/, /^Maybe later$/]) {
    const dismiss = page.getByRole('button', { name }).first();
    if (await dismiss.isVisible()) await dismiss.click();
  }
  const chooseCity = page.getByRole('button', { name: 'Choose a city instead', exact: true });
  const home = page.locator('.phone-frame > .quiet-rail-home');
  await expect.poll(() => page.locator('.phone-frame > .quiet-rail-home, .galaxy-location-secondary:enabled').count(), { timeout: 30_000 }).toBeGreaterThan(0);
  if (!await home.isVisible() && await chooseCity.isVisible()) {
    await chooseCity.click();
    await page.getByLabel('City to explore', { exact: true }).fill('Boston');
    await page.getByRole('button', { name: 'Show people', exact: true }).click();
  }
  await expect(home).toBeVisible({ timeout: 30_000 });
  const todayReminder = page.getByRole('button', { name: /^Dismiss Share one fresh moment$/ });
  if (await todayReminder.isVisible()) await todayReminder.click();
  const trigger = page.getByRole('button', { name: 'Open Home tools', exact: true });
  await expect(trigger).toBeVisible();
  await expect(page.locator('.phone-frame .brand-wordmark')).toHaveCount(0);
  await expect(home.locator('.home-today-tools')).toHaveCount(0);
  await expect(page.locator('.phone-frame > .global-boost-button')).toHaveCount(0);
  await expect(home.locator('.cinematic-photo-main')).toHaveCount(1);
  await expect(home.locator('.film-count, .media-bars')).toHaveCount(0);
  await expect(page.locator('.tabbar .tab-brand-symbol')).toBeVisible();
  await expect.poll(() => home.locator('.cinematic-photo-main').evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  for (const button of await home.locator('.home-action-rail button').all()) {
    await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
  for (const viewport of [{ width: 320, height: 740 }, { width: 393, height: 852 }, { width: 430, height: 932 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await trigger.click();
    const tools = page.getByRole('dialog', { name: 'Tools', exact: true });
    await expect(tools).toBeVisible();
    await expect(tools.locator('.home-tools-list > button')).toHaveCount(5);
    const fits = await tools.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth + 1 && box.top >= 0 && box.bottom <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1;
    });
    expect(fits).toBe(true);
    await page.keyboard.press('Escape');
    await expect(tools).toBeHidden();
    await expect(trigger).toBeFocused();
  }
  await page.setViewportSize({ width: 393, height: 852 });
  const destinations = [
    ['Filters', '.filter-dialog', 'Close filters'],
    ['Announcements', '.voice-briefing-dialog', 'Close voice briefing'],
    ['Boost / Profile Lift', '.boost-dialog', 'Close Profile Lift'],
    ['Calendar & Today', '.today-composer', 'Close Today composer'],
    ['Fresh Moments', '.today-feed-dialog', 'Close all Today updates'],
  ];
  for (const [name, selector, close] of destinations) {
    await trigger.click();
    const tools = page.getByRole('dialog', { name: 'Tools', exact: true });
    const row = tools.getByRole('button', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    await expect(row).toBeEnabled();
    await row.click();
    await expect(tools).toBeHidden();
    await expect(page.getByRole('button', { name: close, exact: true })).toBeVisible();
    // The close control proves the actual destination opened; no publishing or purchase is performed.
    if (selector !== '.today-composer') await expect(page.locator(selector)).toBeVisible();
    await page.getByRole('button', { name: close, exact: true }).click();
  }
  let sends = 0;
  page.on('request', (req) => { if (req.method() === 'POST' && /\/api\/(interactions|billing|conversations)/.test(req.url())) sends++; });
  // Different legacy fixtures can share a placeholder URL; identity must change.
  const first = await home.locator('.cinematic-photo-main').getAttribute('alt');
  await home.getByRole('button', { name: /^Pass on / }).click();
  await expect(home.locator('.cinematic-photo-main')).not.toHaveAttribute('alt', first!);
  expect(sends).toBe(0);
  await home.locator('.profile-card-open').click();
  await expect(page.getByRole('button', { name: 'Close full profile', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close full profile', exact: true }).click();
  for (const tab of ['Galaxy', 'Likes', 'Chat', 'Profile', 'Spike']) {
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: new RegExp(`^${tab}(?:,|$)`) }).click();
    if (tab !== 'Spike') await expect(trigger).toBeHidden();
  }
  await expect(trigger).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.nativePlatform = 'ios';
    document.documentElement.style.setProperty('--ios-safe-top', '59px');
    document.documentElement.style.setProperty('--ios-safe-bottom', '34px');
  });
  expect((await trigger.boundingBox())!.y).toBeGreaterThanOrEqual(59);
  await trigger.click();
  const menu = page.getByRole('dialog', { name: 'Tools', exact: true });
  await expect(menu).toBeVisible();
  expect((await menu.boundingBox())!.y).toBeGreaterThanOrEqual(59);
  await info.attach('cinematic-tools-open', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Close Home tools', exact: true }).click();
  await info.attach('cinematic-home', { body: await page.screenshot(), contentType: 'image/png' });
  expect(runtimeErrors).toEqual([]);
});
