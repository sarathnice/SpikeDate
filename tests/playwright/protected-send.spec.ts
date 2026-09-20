import { test, expect, type Page } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test.beforeEach(async ({ baseURL }) => {
  test.skip(
    !['localhost', '127.0.0.1'].includes(new URL(baseURL!).hostname),
    'Fresh-send credit/fixture tests run only against an isolated local database.',
  );
});

async function prepareSender(page: Page, number: number) {
  // Fresh-send tests are destructive to allowances: never run against stage/real users.
  const configured = new URL(
    process.env.SPIKEDATE_UI_URL || 'http://127.0.0.1:3007',
  );
  expect(['localhost', '127.0.0.1']).toContain(configured.hostname);
  await loginSynthetic(page, number);
  const account = await (await page.request.get('/api/profile')).json();
  expect(account.readiness.ready, JSON.stringify(account.readiness)).toBe(true);
  if (account.wallet.super_spikes < 2) {
    const replenished = await page.request.post('/api/billing/purchase', {
      data: {
        productId: 'spikedate.plus.weekly',
        provider: 'mock',
        transactionId: `protection-fixture-${crypto.randomUUID()}`,
      },
    });
    expect(replenished.ok()).toBe(true);
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Profile', exact: true }),
    ).toBeVisible();
  }
}

test('Like failure/retry, explicit Spike upgrade, duplicate protection and recipient delivery', async ({
  page,
  browser,
}, info) => {
  const senderNumber = info.project.name === 'ios-mobile' ? 48 : 49;
  await prepareSender(page, senderNumber);
  const sender = (await (await page.request.get('/api/profile')).json()).profile
    .display_name;
  const like = page.getByRole('button', { name: /^Like [A-Za-z]/ }).first();
  await expect(like).toBeVisible();
  const candidates = (
    await (await page.request.get('/api/discover?limit=100')).json()
  ).profiles;
  const incoming = (await (await page.request.get('/api/interactions')).json())
    .incoming;
  const conversations = (
    await (await page.request.get('/api/conversations')).json()
  ).conversations;
  const excluded = new Set([
    ...incoming.map((row: { actor_id: string }) => row.actor_id),
    ...conversations.map((row: { other_user_id: string }) => row.other_user_id),
  ]);
  let targetName = '';
  let target: { id: string; name: string } | undefined;
  for (let index = 0; index < candidates.length; index++) {
    targetName = (await like.getAttribute('aria-label'))!.replace(/^Like /, '');
    target = candidates.find(
      (candidate: { name: string }) => candidate.name === targetName,
    );
    if (target && !excluded.has(target.id)) break;
    await page.getByRole('button', { name: /^Pass on / }).click();
  }
  expect(target && !excluded.has(target.id)).toBeTruthy();
  if (!target) throw new Error('No unmatched synthetic recipient remains.');
  expect(target.id).toMatch(/^test-\d{3}$/);
  const remaining = () =>
    page.evaluate(
      (number) =>
        JSON.parse(
          localStorage.getItem(
            `pulse-daily-likes:test${String(number).padStart(3, '0')}@spikedate.test`,
          ) || 'null',
        ),
      senderNumber,
    );
  const before = await remaining();
  expect(before?.remaining).toBeGreaterThan(0);
  let failedKey = '';
  await page.route('**/api/interactions', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    failedKey = route.request().postDataJSON().idempotencyKey;
    await route.fulfill({
      status: 503,
      json: { error: 'Simulated send failure' },
    });
  });
  await like.click();
  await expect(page.locator('.toast')).toContainText('could not confirm');
  await expect(like).toBeEnabled();
  expect(await remaining()).toEqual(before);
  await page.unroute('**/api/interactions');
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/interactions') &&
      response.request().method() === 'POST',
  );
  await like.click();
  const sent = await saved;
  expect(sent.status()).toBe(201);
  expect(sent.request().postDataJSON().idempotencyKey).toBe(failedKey);
  const openSent = async () => {
    await page.getByRole('button', { name: /^Likes/ }).click();
    await page.getByRole('tab', { name: /You liked/ }).click();
    const row = page
      .locator('.sent-like')
      .filter({
        has: page.getByRole('button', { name: targetName, exact: true }),
      });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: targetName, exact: true }).click();
  };
  await openSent();
  await expect(page.locator('.connection-sent-state')).toHaveText('Liked');
  await page
    .getByRole('button', { name: 'Send a Spike introduction', exact: true })
    .click();
  const upgrade = page.getByRole('button', {
    name: 'Upgrade to Spike · uses 1 Spike',
  });
  await expect(upgrade).toBeVisible();
  const walletBefore = (await (await page.request.get('/api/profile')).json())
    .wallet.super_spikes;
  const upgraded = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/interactions') &&
      response.request().method() === 'POST',
  );
  await upgrade.click();
  const response = await upgraded;
  expect(await response.json()).toMatchObject({
    upgraded: true,
    charged: true,
    superSpikesRemaining: walletBefore - 1,
  });
  await openSent();
  await expect(page.locator('.connection-sent-state')).toHaveText('Spike sent');
  await page
    .getByRole('button', { name: 'Send a Spike introduction', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Spike already sent', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Close Spike', exact: true }).click();
  for (const kind of ['like', 'super_spike']) {
    const duplicate = await page.request.post('/api/interactions', {
      data: {
        targetUserId: target.id,
        kind,
        idempotencyKey: crypto.randomUUID(),
      },
    });
    expect(await duplicate.json()).toMatchObject({
      duplicate: true,
      charged: false,
      superSpikesRemaining: walletBefore - 1,
    });
  }
  const context = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const recipient = await context.newPage();
    await loginSynthetic(recipient, Number(target.id.slice(-3)));
    const incoming = (
      await (await recipient.request.get('/api/interactions')).json()
    ).incoming.filter(
      (row: { actor_id: string }) =>
        row.actor_id === `test-${String(senderNumber).padStart(3, '0')}`,
    );
    expect(incoming).toHaveLength(1);
    expect(incoming[0].kind).toBe('super_spike');
    await recipient.getByRole('button', { name: /^Likes/ }).click();
    await recipient.getByRole('tab', { name: /Liked you/ }).click();
    await expect(
      recipient.locator('.incoming-row').filter({ hasText: sender }),
    ).toContainText('Sent you a Spike');
    await info.attach('recipient-single-Spike', {
      body: await recipient.screenshot(),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});

test('real D1 concurrent sends and request retries debit only once', async ({
  page,
}, info) => {
  await prepareSender(page, info.project.name === 'ios-mobile' ? 48 : 49);
  const candidates = (
    await (await page.request.get('/api/discover?limit=100')).json()
  ).profiles;
  const target = candidates.find((candidate: { id: string }) =>
    /^test-/.test(candidate.id),
  );
  expect(target).toBeTruthy();
  const before = (await (await page.request.get('/api/profile')).json()).wallet
    .super_spikes;
  expect(before).toBeGreaterThan(0);
  const send = () =>
    page.request.post('/api/interactions', {
      data: {
        targetUserId: target.id,
        kind: 'super_spike',
        idempotencyKey: crypto.randomUUID(),
      },
    });
  const results = await Promise.all([send(), send(), send()]);
  expect(results.map((response) => response.status()).sort()).toEqual([
    200, 200, 201,
  ]);
  expect(
    (await (await page.request.get('/api/profile')).json()).wallet.super_spikes,
  ).toBe(before - 1);
});
