import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test.skip(
  ({ baseURL }) =>
    !baseURL ||
    !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname) ||
    new URL(baseURL).port !== '3007',
  'Dedicated local synthetic accounts only.',
);

test('Read receipts: fetching is read-only, offscreen messages remain unread, visible messages acknowledge and sender sees Read', async ({
  page,
  browser,
}, info) => {
  await loginSynthetic(page, 1);
  const context = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const sender = await context.newPage();
    await loginSynthetic(sender, 2);
    const chats = await (await sender.request.get('/api/conversations')).json();
    const chat = chats.conversations.find(
      (entry: { display_name: string }) => entry.display_name === 'Maya',
    );
    expect(chat.id).toBeTruthy();
    const prefix = `Read QA ${info.project.name} ${Date.now()}`;
    const ids: string[] = [];
    for (let index = 0; index < 15; index++) {
      const response = await sender.request.post(
        `/api/conversations/${chat.id}/messages`,
        {
          data: {
            body: `${prefix} ${index}: A coffee, a beautiful walk and a weekend adventure. Which would you pick for a first date?`,
            clientId: `${prefix}-${index}`,
          },
        },
      );
      expect(response.ok()).toBe(true);
      ids.push((await response.json()).message.id);
    }
    const history = async () =>
      (
        await (
          await sender.request.get(`/api/conversations/${chat.id}/messages`)
        ).json()
      ).messages as Array<{ id: string; delivered_at: number | null; read_at: number | null }>;
    const recipientHistory = await page.request.get(
      `/api/conversations/${chat.id}/messages`,
    );
    expect(recipientHistory.ok()).toBe(true);
    expect(
      (await history()).find((message) => message.id === ids[0])?.read_at,
    ).toBeNull();
    // A sender must not mark their own messages read.
    expect(
      (
        await sender.request.patch(`/api/conversations/${chat.id}/messages`, {
          data: { messageIds: ids },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (await history()).find((message) => message.id === ids[0])?.read_at,
    ).toBeNull();
    await page.getByRole('button', { name: /^Chat/ }).click();
    const unreadRow = page.locator('.chat-row').filter({ hasText: 'Noah' });
    await expect(unreadRow.locator('.chat-meta b')).toBeVisible();
    expect(
      await unreadRow
        .locator('.chat-meta b')
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe('rgb(255, 194, 199)');
    await page
      .getByRole('button', { name: 'Chat with Noah', exact: true })
      .click();
    await expect(page.locator('.thread')).toHaveAttribute('aria-busy', 'false');
    await expect
      .poll(async () => (await history()).find((message) => message.id === ids[0])?.delivered_at)
      .not.toBeNull();
    await expect(page.locator('.chat-scroll-indicator')).toBeVisible();
    expect(
      await page
        .locator('.chat-scroll-indicator')
        .evaluate((el) => getComputedStyle(el).width),
    ).toBe('3px');
    await expect
      .poll(
        async () =>
          (await history()).find((message) => message.id === ids.at(-1))
            ?.read_at,
      )
      .not.toBeNull();
    expect(
      (await history()).find((message) => message.id === ids[0])?.read_at,
    ).toBeNull();
    await sender.getByRole('button', { name: /^Chat/ }).click();
    await sender
      .getByRole('button', { name: 'Chat with Maya', exact: true })
      .click();
    await expect(sender.locator('.message-status')).toContainText('Read ·');
    // Background history must not acknowledge an offscreen message when scrolled.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page
      .locator(`[data-message-id="${ids[0]}"]`)
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    expect(
      (await history()).find((message) => message.id === ids[0])?.read_at,
    ).toBeNull();
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect
      .poll(
        async () =>
          (await history()).find((message) => message.id === ids[0])?.read_at,
      )
      .not.toBeNull();
    // An open sender thread refreshes a receipt without reopening the chat.
    const saved = await sender.request.post(
      `/api/conversations/${chat.id}/messages`,
      { data: { body: `${prefix}: live receipt`, clientId: `${prefix}-live` } },
    );
    expect(saved.ok()).toBe(true);
    const liveId = (await saved.json()).message.id;
    await expect
      .poll(
        async () =>
          (await history()).find((message) => message.id === liveId)?.read_at,
      )
      .toBeNull();
    await expect(sender.locator(`[data-message-id="${liveId}"]`)).toBeVisible();
    await expect(sender.locator('.message-status')).toHaveText('Delivered');
    await expect(
      page.locator('.bubble').filter({ hasText: `${prefix}: live receipt` }),
    ).toHaveCount(1);
    await page.locator('.message-body').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(
        async () =>
          (await history()).find((message) => message.id === liveId)?.read_at,
      )
      .not.toBeNull();
    await expect(sender.locator('.message-status')).toContainText('Read ·');
    await page.screenshot({
      path: `outputs/chat-read-${info.project.name}.png`,
    });
  } finally {
    await context.close();
  }
});
