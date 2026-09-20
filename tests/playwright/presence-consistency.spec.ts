import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';
import { isRecentlyActive } from '../../lib/presence';

for (const state of ['recent', 'expired', 'missing']) {
  const recent = state === 'recent';
  test(`Home and Chat agree for ${state} activity`, async ({ page }) => {
    await page.clock.install();
    const timestamp =
      state === 'missing' ? null : Date.now() - (recent ? 60_000 : 16 * 60_000);
    await page.route('**/api/presence?ids=*', async (route) => {
      await route.fulfill({
        json: {
          presence: [
            {
              id: 'presence-preview',
              state: recent ? 'recent' : 'offline',
              onlineUntil: null,
              lastActiveAt: timestamp,
            },
          ],
        },
      });
    });
    // Deterministic response fixtures: exercise actual rendering without changing
    // any user's activity timestamp, matches or messages in the database.
    await page.route('**/api/discover?*', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      expect(data.profiles.length).toBeGreaterThan(0);
      const profile = data.profiles[0];
      await route.fulfill({
        response,
        json: {
          ...data,
          profiles: [
            {
              ...profile,
              id: 'presence-preview',
              name: 'Presence Preview',
              active: true,
              lastActiveAt: timestamp,
            },
          ],
        },
      });
    });
    await page.route('**/api/conversations', async (route) => {
      await route.fulfill({
        json: {
          conversations: [
            {
              id: 'presence-preview',
              other_user_id: 'presence-preview',
              display_name: 'Presence Preview',
              preview: 'Activity preview',
              unread_count: 0,
              active: true,
              lastActiveAt: timestamp,
            },
          ],
        },
      });
    });
    await page.route(
      '**/api/conversations/presence-preview/messages',
      async (route) => {
        await route.fulfill({ json: { messages: [] } });
      },
    );
    await loginSynthetic(page, 42);
    await expect(page.locator('.profile-card h1')).toContainText(
      'Presence Preview',
    );
    if (recent) {
      await expect(page.locator('.profile-presence')).toHaveText(
        'Active recently',
      );
      await expect(page.locator('.profile-presence')).toHaveAttribute(
        'aria-label',
        'Presence Preview was active in the last 15 minutes',
      );
    } else await expect(page.locator('.profile-presence')).toHaveCount(0);
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    const row = page
      .locator('.chat-row')
      .filter({ hasText: 'Presence Preview' });
    await expect(row).toBeVisible();
    await expect(row.locator('i[aria-label]')).toHaveCount(recent ? 1 : 0);
    await row.locator('.chat-conversation').click();
    await expect(page.locator('.thread-name-link small')).toHaveText(
      recent ? 'Active recently' : 'Matched on SpikeDate',
    );
    if (recent) {
      await expect(page.locator('.thread-name-link small i')).toHaveCSS(
        'width',
        '6px',
      );
      await expect(page.locator('.thread-name-link small i')).toHaveCSS(
        'height',
        '6px',
      );
    }
    await expect(page.getByText('Online now', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Active now', { exact: true })).toHaveCount(0);
    const status = page.locator('.thread-name-link small');
    const box = await status.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    if (recent) {
      await page.clock.fastForward(16 * 60_000);
      await expect(status).toHaveText('Matched on SpikeDate');
    }
  });
}

test('real discovery and conversation APIs use activity timestamps, not invented presence', async ({
  page,
}) => {
  await loginSynthetic(page, 1);
  for (const [endpoint, collection] of [
    ['/api/discover?limit=50', 'profiles'],
    ['/api/conversations', 'conversations'],
  ]) {
    const response = await page.request.get(endpoint);
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data[collection].length).toBeGreaterThan(0);
    for (const item of data[collection]) {
      expect(item).toHaveProperty('lastActiveAt');
      expect(item.active).toBe(isRecentlyActive(item.lastActiveAt));
    }
  }
});
