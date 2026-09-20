import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test.skip(
  ({ baseURL }) => new URL(baseURL!).port !== '3007',
  'Local synthetic accounts only.',
);

test('Quiet Rail B: four actions, separated Today tools, photo and header fit across mobile themes', async ({
  page,
}, info) => {
  await loginSynthetic(page, 1);
  const home = page.locator('.quiet-rail-home');
  await expect(home).toBeVisible();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of [
      'default',
      'aurora',
      'velvet',
      'solar',
      'liquid',
      'lime',
      'gallery',
    ]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.pulseTheme =
          value === 'lime' ? 'liquid' : value;
        document.documentElement.dataset.pulseAccent =
          value === 'lime' ? 'lime' : '';
      }, theme);
      const rail = home.locator('.home-action-rail');
      await expect(rail.locator('button')).toHaveCount(4);
      await expect(rail).toHaveCSS('flex-direction', 'column');
      await expect(home.locator('.home-today-tools button')).toHaveCount(2);
      await expect(home.locator('.distance .lucide-map-pin')).toBeVisible();
      await expect(
        home.locator('.chips span:first-child .lucide-heart'),
      ).toBeVisible();
      for (const icon of await home.locator('.home-detail-icon').all()) {
        await expect(icon).toHaveCSS('color', 'rgb(210, 213, 221)');
        const box = await icon.boundingBox();
        expect(box!.width).toBe(13);
        expect(box!.height).toBe(13);
      }
      const geometry = await page.locator('.phone-frame').evaluate((el) => {
        const bounds = el.getBoundingClientRect();
        const box = (selector: string) =>
          el.querySelector(selector)!.getBoundingClientRect();
        const rail = box('.home-action-rail');
        const details = box('.card-content');
        const nav = box('.tabbar');
        const today = box('.today-compose');
        const boost = box('.global-boost-button');
        const filter = box('.filter-button');
        const brand = box('.topbar .wordmark');
        const photo = box('.cinematic-photo-main');
        return {
          railFits: rail.right <= bounds.right && rail.bottom < nav.top,
          detailsFits: details.right < rail.left && details.bottom < nav.top,
          topFits:
            filter.right <= brand.left + 1 &&
            brand.right <= today.left + 1 &&
            today.right <= boost.left + 1,
          topAligned: Math.abs(today.top - boost.top) < 1,
          photoCovers:
            photo.left <= bounds.left + 1 &&
            photo.right >= bounds.right - 1 &&
            photo.top <= bounds.top + 1 &&
            photo.bottom >= nav.top - 1,
          buttons: [
            ...el.querySelectorAll(
              '.home-action-rail button, .home-today-tools button',
            ),
          ].map((button) => button.getBoundingClientRect().height),
          frost: getComputedStyle(el.querySelector('.topbar')!).backdropFilter,
        };
      });
      expect(geometry.railFits, `${theme}/${width}: rail`).toBe(true);
      expect(geometry.detailsFits, `${theme}/${width}: details`).toBe(true);
      expect(geometry.topFits, `${theme}/${width}: header`).toBe(true);
      expect(geometry.topAligned).toBe(true);
      expect(geometry.photoCovers).toBe(true);
      expect(geometry.buttons.every((height) => height >= 44)).toBe(true);
      expect(geometry.frost).toBe('none');
      await expect(rail.locator('.gallery-like-heart')).toHaveCSS(
        'color',
        'rgb(255, 37, 63)',
      );
    }
  }
  await page.evaluate(() => {
    document.documentElement.dataset.pulseTheme = 'default';
    document.documentElement.dataset.pulseAccent = '';
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      home
        .locator('.cinematic-photo-main')
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await info.attach('B-quiet-rail-home', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
  await home.locator('.today-compose').click();
  await expect(page.locator('.today-composer-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close Today composer' }).click();
  await home.locator('.today-feed').click();
  await expect(page.locator('.today-feed-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close all Today updates' }).click();
  await page.locator('.global-boost-button').click();
  await expect(page.locator('.boost-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close Profile Lift' }).click();
  await home.locator('.spark').click();
  await expect(page.locator('.note-dialog')).toBeVisible();
  await page.locator('.note-sheet-close').click();
  await home
    .locator('.profile-card-open')
    .click({ position: { x: 80, y: 220 } });
  await expect(page.locator('.profile-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'Close full profile' }).click();
  const before = await home.locator('.name-row h1').innerText();
  await home.getByRole('button', { name: /^Pass on/ }).click();
  await expect(home.locator('.name-row h1')).not.toHaveText(before);
});

test('Quiet Rail B: Like advances without a note, Save toggles, and Today/tonight remain compact', async ({
  page,
}, info) => {
  // Isolated response/storage fixtures: never spend a real account allowance.
  let presenceState = 'online';
  await page.route('**/api/presence*', (route) => {
    if (route.request().method() !== 'GET')
      return route.fulfill({ json: { ok: true } });
    const ids = new URL(route.request().url()).searchParams.get('ids');
    return route.fulfill({
      json: ids
        ? {
            presence: ids.split(',').map((id) => ({
              id,
              state: presenceState,
              onlineUntil:
                presenceState === 'online' ? Date.now() + 60000 : null,
              lastActiveAt: presenceState === 'hidden' ? null : Date.now(),
            })),
          }
        : { showOnline: false },
    });
  });
  await page.route('**/api/profile', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      json: { ...(await response.json()), subscription: { status: 'active' } },
    });
  });
  await page.route('**/api/conversations', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { conversations: [] } })
      : route.continue(),
  );
  const sends: Record<string, unknown>[] = [];
  await page.route('**/api/interactions', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { incoming: [], outgoing: [] } });
    const input = route.request().postDataJSON();
    sends.push(input);
    return route.fulfill({
      json: { interaction: { kind: input.kind }, match: null },
    });
  });
  await page.route('**/api/discover?*', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await route.fulfill({
      json: {
        ...data,
        profiles: data.profiles.map((profile: Record<string, unknown>) => ({
          ...profile,
          availability: {
            localDate,
            startAt: now.toISOString(),
            endAt: new Date(Date.now() + 3600000).toISOString(),
            timezone: 'America/New_York',
          },
        })),
      },
    });
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      'pulse-daily-stories',
      JSON.stringify(
        Array.from({ length: 50 }, (_, i) => ({
          id: `quiet-rail-today-fixture-${i}`,
          authorEmail: `test${String(i + 1).padStart(3, '0')}@spikedate.test`,
          authorName: 'Sample profile',
          caption:
            'Finding a new coffee spot, then taking a walk by the water. A quiet evening and a good conversation would be lovely.',
          prompt: 'What are you doing today?',
          visibility: 'discover',
          repliesEnabled: true,
          viewedBy: [],
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        })),
      ),
    ),
  );
  await loginSynthetic(page, 1);
  const home = page.locator('.quiet-rail-home');
  await expect(home).toBeVisible();
  await expect(home.locator('.today-card-combined')).toBeVisible();
  await expect(home.locator('.profile-presence')).toHaveText('Online now');
  await expect(home.locator('.profile-presence > span')).toBeVisible();
  await expect(home.locator('.tonight-card-status .lucide-moon')).toBeVisible();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const geometry = await home.locator('.card-content').evaluate((el) => ({
      width: el.clientWidth,
      scroll: el.scrollWidth,
      top: el.getBoundingClientRect().top,
      todayHeight: el
        .querySelector('.today-card-pill strong, .tonight-card-status strong')!
        .getBoundingClientRect().height,
    }));
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
    expect(geometry.top).toBeGreaterThan(400);
    expect(geometry.todayHeight).toBeLessThanOrEqual(37);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      home
        .locator('.cinematic-photo-main')
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  // Let Chromium repaint the full-size image after successive mobile resizes.
  await home.locator('.cinematic-photo-main').evaluate(async (el) => {
    await (el as HTMLImageElement).decode();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `outputs/quiet-rail-today-${info.project.name}.png`,
    animations: 'disabled',
  });
  presenceState = 'recent';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(home.locator('.profile-presence')).toHaveText('Active recently');
  presenceState = 'hidden';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(home.locator('.profile-presence')).toHaveCount(0);
  const save = home.locator('.home-action-rail button').last();
  await save.click();
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  await save.click();
  await expect(save).toHaveAttribute('aria-pressed', 'false');
  const before = await home.locator('.name-row h1').innerText();
  await home.locator('.like').click();
  await expect(home.locator('.name-row h1')).not.toHaveText(before);
  await expect(page.locator('.note-dialog')).toHaveCount(0);
  await expect
    .poll(() => sends.filter((input) => input.kind === 'like').length)
    .toBe(1);
  expect(sends.find((input) => input.kind === 'like')!.note).toBeUndefined();
});
