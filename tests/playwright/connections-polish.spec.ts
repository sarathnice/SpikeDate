import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test.skip(
  ({ baseURL }) => new URL(baseURL!).port !== '3007',
  'Local synthetic fixtures only.',
);

test('Mobile connection lists: 50 likes/chats, search, filters, themes and narrow layouts', async ({
  page,
}, info) => {
  // Response fixtures exercise list volume without sending interactions or buying Plus.
  await page.route('**/api/profile', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const account = await response.json();
    await route.fulfill({
      json: { ...account, subscription: { status: 'active' } },
    });
  });
  const incoming = Array.from({ length: 50 }, (_, i) => ({
    id: `fixture-like-${i}`,
    actor_id: `fixture-user-${i}`,
    display_name: `Connection ${String(i + 1).padStart(2, '0')}`,
    age: 25,
    gender: 'woman',
    bio: 'A thoughtful introduction',
    city: 'Boston',
    relationship_goal: 'Long-term',
    verification_status: 'unverified',
    kind: i % 2 ? 'like' : 'super_spike',
    note:
      i % 2
        ? null
        : 'Coffee, a bookstore, and a walk by the water sound like a lovely first date.',
    imageUrl: '/imani.png',
  }));
  await page.route('**/api/interactions', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ json: { incoming, outgoing: [] } })
      : route.continue(),
  );
  await page.route('**/api/conversations', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          json: {
            conversations: incoming.map((row, i) => ({
              id: `fixture-chat-${i}`,
              other_user_id: row.actor_id,
              display_name: row.display_name,
              preview:
                'How was your day? I found a lovely new coffee place to try together.',
              unread_count: i % 2 ? 0 : 12,
              active: false,
              lastActiveAt: null,
            })),
          },
        })
      : route.continue(),
  );
  await loginSynthetic(page, 1);
  await page.getByRole('button', { name: /^Likes/ }).click();
  await expect(page.locator('.incoming-row')).toHaveCount(50);
  await expect(
    page.getByRole('button', { name: 'New', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Search likes').fill('Connection 50');
  await expect(page.locator('.incoming-row')).toHaveCount(1);
  await expect(page.locator('.incoming-row')).toContainText('Connection 50');
  await page.getByLabel('Search likes').fill('not-found');
  await expect(page.locator('.empty-likes-state')).toBeVisible();
  await page.getByLabel('Search likes').fill('');
  await page.getByRole('button', { name: 'Spikes', exact: true }).click();
  await expect(page.locator('.incoming-row')).toHaveCount(25);
  await page.getByRole('button', { name: 'All', exact: true }).click();
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
      await page.evaluate(
        (theme) =>
          document.documentElement.setAttribute('data-pulse-theme', theme),
        theme,
      );
      const layout = await page.locator('.likes-screen').evaluate((el) => ({
        overflow: el.scrollWidth > el.clientWidth + 1,
        actions: [...el.querySelectorAll('.decision-actions button')]
          .slice(0, 2)
          .map((button) => button.getBoundingClientRect().height),
        icons: el.querySelectorAll('.likes-tabs svg').length,
      }));
      expect(layout.overflow, `${theme}/${width} likes`).toBe(false);
      expect(layout.icons).toBe(3);
      expect(layout.actions.every((height) => height >= 44)).toBe(true);
    }
  }
  await page.evaluate(() =>
    document.documentElement.setAttribute('data-pulse-theme', 'default'),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `outputs/connections-likes-${info.project.name}.png`,
    animations: 'disabled',
  });
  await page.locator('.incoming-row').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.incoming-row').last()).toBeVisible();
  await page.getByRole('button', { name: /^Chat/ }).click();
  await expect(page.locator('.chat-row')).toHaveCount(50);
  await page.getByLabel('Search chats').fill('Connection 50');
  await expect(page.locator('.chat-row')).toHaveCount(1);
  await page.getByLabel('Search chats').fill('');
  await page
    .locator('.chat-inbox-filters button')
    .filter({ hasText: 'Unread' })
    .click();
  await expect(page.locator('.chat-row')).toHaveCount(25);
  for (const row of await page.locator('.chat-row').all())
    await expect(row.locator('.chat-meta b')).toHaveText('12');
  await page
    .locator('.chat-inbox-filters button')
    .filter({ hasText: 'All' })
    .click();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page
        .locator('.chat-screen')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `outputs/connections-chat-${info.project.name}.png`,
    animations: 'disabled',
  });
  await page.locator('.chat-row').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.chat-row').last()).toBeVisible();
});

test('Real local account: Likes tabs, saved list and chat navigation remain usable', async ({
  page,
}) => {
  await loginSynthetic(page, 1);
  await page.getByRole('button', { name: /^Likes/ }).click();
  for (const tab of [/You liked/, /Matches/, /Liked you/]) {
    await page.getByRole('tab', { name: tab }).click();
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  }
  await page.getByRole('button', { name: /^Chat/ }).click();
  await page
    .getByRole('button', { name: 'Chat with Lena', exact: true })
    .click();
  await expect(page.locator('.thread')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Send message', exact: true }),
  ).toBeDisabled();
});
