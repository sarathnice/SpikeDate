import { expect, test, type Page } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test.skip(
  ({ baseURL }) =>
    !baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname),
  'Presence lifecycle tests only change synthetic users in the local runtime.',
);

async function readPresence(page: Page, id = 'test-002') {
  const response = await page.request.get(`/api/presence?ids=${id}`);
  expect(response.ok()).toBe(true);
  return (await response.json()).presence[0];
}
async function setVisible(page: Page, visible: boolean) {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (value ? 'visible' : 'hidden'),
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible);
}
async function openNoahChat(page: Page) {
  await page.getByRole('button', { name: /^Chat/ }).click({ timeout: 12_000 });
  await page
    .locator('.chat-row')
    .filter({ hasText: 'Noah' })
    .locator('.chat-conversation')
    .click();
}

test('two users: online, full profile, privacy persistence, multiple tabs and background expiry', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  const lena = await context.newPage();
  try {
    await loginSynthetic(lena, 2);
    await lena.request.patch('/api/presence', { data: { showOnline: true } });
    await lena.reload();
    await loginSynthetic(page, 1);
    await expect
      .poll(async () => (await readPresence(page)).state)
      .toBe('online');
    await openNoahChat(page);
    const status = page.locator('.thread-name-link small');
    await expect(status).toHaveText('Online now', { timeout: 25_000 });
    await page.screenshot({
      path: `outputs/qa/live-presence/examples/online-${info.project.name}.png`,
    });
    await page.locator('.thread-name-link').click();
    await expect(
      page.getByRole('dialog').locator('.profile-presence'),
    ).toHaveText('Online now');
    await page.keyboard.press('Escape');
    await lena.getByRole('button', { name: 'Profile', exact: true }).click();
    const setting = lena.getByRole('switch', {
      name: 'Show my activity status',
    });
    await setting.scrollIntoViewIfNeeded();
    await expect(setting).toHaveAttribute('aria-checked', 'true');
    const box = await setting.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(lena.viewportSize()!.width);
    await setting.click();
    await expect
      .poll(async () => (await readPresence(page)).state)
      .toBe('hidden');
    await expect(status).toHaveText('Matched on SpikeDate', {
      timeout: 25_000,
    });
    await lena.reload();
    await lena.getByRole('button', { name: 'Profile', exact: true }).click();
    await expect(setting).toHaveAttribute('aria-checked', 'false');
    await setting.scrollIntoViewIfNeeded();
    await setting.click();
    await expect
      .poll(async () => (await readPresence(page)).state)
      .toBe('online');
    await expect(status).toHaveText('Online now', { timeout: 25_000 });
    const anotherTab = await context.newPage();
    const heartbeat = anotherTab.waitForResponse(
      (response) =>
        response.url().endsWith('/api/presence') &&
        response.request().method() === 'POST',
    );
    await anotherTab.goto('/');
    expect((await heartbeat).ok()).toBe(true);
    const left = lena.waitForResponse(
      (response) =>
        response.url().endsWith('/api/presence') &&
        response.request().method() === 'DELETE',
    );
    await setVisible(lena, false);
    expect((await left).ok()).toBe(true);
    expect((await readPresence(page)).state).toBe('online');
    const secondLeft = anotherTab.waitForResponse(
      (response) =>
        response.url().endsWith('/api/presence') &&
        response.request().method() === 'DELETE',
    );
    await setVisible(anotherTab, false);
    expect((await secondLeft).ok()).toBe(true);
    await expect
      .poll(async () => (await readPresence(page)).state)
      .toBe('recent');
    await expect(status).toHaveText('Active recently', { timeout: 25_000 });
    await page.screenshot({
      path: `outputs/qa/live-presence/examples/recent-${info.project.name}.png`,
    });
    await setVisible(lena, true);
    await expect
      .poll(async () => (await readPresence(page)).state)
      .toBe('online');
    const logout = await lena.request.post('/api/auth/logout');
    expect(logout.ok()).toBe(true);
    await expect
      .poll(async () => (await readPresence(page)).state)
      .toBe('recent');
  } finally {
    await context.setOffline(false);
    await lena.request.post('/api/auth/logout').catch(() => {});
    await context.close();
  }
});

test('lost connection: real server lease expires without a leave request', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(160_000);
  const context = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  const lena = await context.newPage();
  try {
    await loginSynthetic(lena, 2);
    await lena.request.patch('/api/presence', { data: { showOnline: true } });
    await lena.reload();
    await loginSynthetic(page, 1);
    await expect
      .poll(async () => (await readPresence(page)).state)
      .toBe('online');
    await openNoahChat(page);
    await expect(page.locator('.thread-name-link small')).toHaveText(
      'Online now',
    );
    const initial = await readPresence(page);
    expect(initial.onlineUntil).toBeGreaterThan(Date.now());
    await context.setOffline(true);
    // Wait on real server time, rather than only advancing the browser clock.
    await expect
      .poll(async () => (await readPresence(page)).state, {
        timeout: 110_000,
        intervals: [5000],
      })
      .toBe('recent');
    await expect(page.locator('.thread-name-link small')).toHaveText(
      'Active recently',
      { timeout: 25_000 },
    );
    const expired = await readPresence(page);
    expect(expired.onlineUntil).toBeNull();
    await info.attach('real-lease-expiry', {
      body: JSON.stringify({ initial, expired }),
      contentType: 'application/json',
    });
    await context.setOffline(false);
    await expect
      .poll(async () => (await readPresence(page)).state)
      .toBe('online');
  } finally {
    await context.setOffline(false);
    await lena.request.post('/api/auth/logout').catch(() => {});
    await context.close();
  }
});
