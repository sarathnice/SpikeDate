import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test('cross-account: UI Like is persisted and reaches the recipient Incoming', async ({
  page,
  browser,
}, info) => {
  await loginSynthetic(page, 46);
  const profile = await page.request.get('/api/profile');
  const sender = (await profile.json()).profile.display_name as string;
  const like = page.getByRole('button', { name: /^Like [A-Za-z]/ }).first();
  await expect(like).toBeVisible();
  const targetName = (await like.getAttribute('aria-label'))!.replace(
    /^Like /,
    '',
  );
  const discover = await page.request.get('/api/discover?limit=50');
  const profiles = (await discover.json()).profiles as {
    id: string;
    name: string;
  }[];
  const target = profiles.find((p) => p.name === targetName);
  expect(
    target?.id,
    'Only synthetic recipient accounts may be changed',
  ).toMatch(/^test-\d{3}$/);
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/interactions') &&
      response.request().method() === 'POST' &&
      response.request().postDataJSON()?.kind === 'like',
  );
  await like.click();
  const result = await saved;
  const body = await result.json();
  await info.attach('Like-delivery-response', {
    body: JSON.stringify(
      { sender, target, status: result.status(), body },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(
    result.ok(),
    `Like persistence returned HTTP ${result.status()}: ${JSON.stringify(body)}`,
  ).toBe(true);
  expect(result.request().postDataJSON().targetUserId).toBe(target!.id);
  const context = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const recipient = await context.newPage();
    await loginSynthetic(recipient, Number(target!.id.slice(-3)));
    await recipient.getByRole('button', { name: /^Likes/ }).click();
    await recipient.getByRole('tab', { name: /Liked you/ }).click();
    const row = recipient.locator('.incoming-row').filter({ hasText: sender });
    await expect(
      row,
      'A separate recipient session must see the sender, not just optimistic local state',
    ).toBeVisible();
    await info.attach('recipient-incoming', {
      body: await recipient.screenshot(),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
