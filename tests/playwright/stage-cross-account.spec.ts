import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test('cross-account: a message and reply reach both matched users with read receipts', async ({
  page,
  browser,
}, info) => {
  await loginSynthetic(page, 1);
  const otherContext = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const other = await otherContext.newPage();
    await loginSynthetic(other, 2);
    const conversationsResponse = await page.request.get('/api/conversations');
    expect(conversationsResponse.ok()).toBe(true);
    const conversations = (await conversationsResponse.json()).conversations as {
      id: string;
      other_user_id: string;
    }[];
    const conversation = conversations.find(
      (entry) => entry.other_user_id === 'test-002',
    );
    expect(conversation?.id, 'The two synthetic users must be matched').toBeTruthy();
    const conversationId = conversation!.id;
    const unique = `Stage QA ${info.project.name} ${Date.now()}`;

    await page.getByRole('button', { name: /^Chat/ }).click();
    await page.getByRole('button', { name: 'Chat with Lena' }).click();
    await expect(page.locator('.thread')).toHaveAttribute('aria-busy', 'false');
    await page.getByRole('textbox', { name: 'Message Lena' }).fill(`${unique} hello`);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('.bubble').filter({ hasText: `${unique} hello` })).toBeVisible();

    const sent = await expect.poll(async () => {
      const response = await page.request.get(`/api/conversations/${conversationId}/messages`);
      if (!response.ok()) return null;
      const messages = (await response.json()).messages as { id: string; body: string; sender_id: string }[];
      return messages.find((message) => message.body === `${unique} hello`) ?? null;
    }).not.toBeNull();
    void sent;
    await other.getByRole('button', { name: /^Chat/ }).click();
    await expect(other.getByRole('button', { name: 'Chat with Maya' })).toBeVisible();
    await other.getByRole('button', { name: 'Chat with Maya' }).click();
    await expect(other.locator('.bubble').filter({ hasText: `${unique} hello` })).toBeVisible();
    await expect(page.locator('.message-status')).toContainText('Read ·', {
      timeout: 20000,
    });

    await other.getByRole('textbox', { name: 'Message Maya' }).fill(`${unique} reply`);
    await other.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('.bubble').filter({ hasText: `${unique} reply` })).toBeVisible({ timeout: 20000 });
    await info.attach('cross-account-chat', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  } finally {
    await otherContext.close();
  }
});

test('cross-account: private photo originals stay private and stage serves optimized photos', async ({
  page,
  browser,
}, info) => {
  await loginSynthetic(page, 1);
  const profileResponse = await page.request.get('/api/profile');
  expect(profileResponse.ok()).toBe(true);
  const profile = (await profileResponse.json()) as {
    media: { id: string; type: string; url: string }[];
  };
  const photo = profile.media.find((item) => item.type === 'photo');
  expect(photo, 'Synthetic user 001 needs a stored photo').toBeTruthy();
  const cardUrl = `/api/media/${photo!.id}?variant=card`;
  const card = await page.request.get(cardUrl, {
    headers: { Accept: 'image/webp' },
  });
  expect(card.ok()).toBe(true);
  expect(card.headers()['content-type']).toMatch(/^image\//);
  expect(card.headers()['cache-control']).toContain('private');
  const ownOriginal = await page.request.get(`/api/media/${photo!.id}?variant=original`);
  expect(ownOriginal.ok()).toBe(true);
  const otherContext = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const other = await otherContext.newPage();
    await loginSynthetic(other, 2);
    const publicCard = await other.request.get(cardUrl, {
      headers: { Accept: 'image/webp' },
    });
    expect(publicCard.ok()).toBe(true);
    const denied = await other.request.get(`/api/media/${photo!.id}?variant=original`);
    expect(denied.status()).toBe(403);
  } finally {
    await otherContext.close();
  }
  await info.attach('image-delivery-headers', {
    body: JSON.stringify({ status: card.status(), headers: card.headers() }, null, 2),
    contentType: 'application/json',
  });
  if (new URL(info.project.use.baseURL!).hostname === 'spikedate-stage.sarathnice.workers.dev') {
    expect(card.headers()['x-spikedate-image-delivery']).toMatch(/^optimized/);
  }
});
