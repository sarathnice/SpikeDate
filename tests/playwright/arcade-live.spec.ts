import { expect, test, type Page } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';
const chatId = 'test-conversation-001-002';
test.skip(
  ({ baseURL }) =>
    !baseURL ||
    !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname) ||
    new URL(baseURL).port !== '3007',
  'Arcade safety fixtures may only be mutated in the dedicated local runtime on port 3007.',
);
async function openArcade(page: Page, partner: string) {
  await page.getByRole('button', { name: /^Chat/ }).click();
  await page
    .locator('.chat-row')
    .filter({ hasText: partner })
    .locator('.chat-conversation')
    .click();
  await page
    .getByRole('button', { name: 'Games and date plans', exact: true })
    .click();
  await page.locator('.play-together-button').click();
  await page.getByRole('button', { name: 'Arcade', exact: true }).click();
  await expect(page.locator('.arcade-connection')).toContainText('Live');
}
async function paired(page: Page, recipient: Page) {
  await loginSynthetic(page, 1);
  await loginSynthetic(recipient, 2);
  expect((await page.request.get('/api/profile')).ok()).toBe(true);
  const a = (await page.context().cookies()).find(
    (c) => c.name === 'spikedate_session',
  );
  const b = (await recipient.context().cookies()).find(
    (c) => c.name === 'spikedate_session',
  );
  expect(a?.value).toBeTruthy();
  expect(b?.value).toBeTruthy();
  expect(a?.value).not.toEqual(b?.value);
  await openArcade(page, 'Noah');
  await openArcade(recipient, 'Maya');
  await expect(page.locator('.arcade-connection')).toContainText('2 of 2');
}
async function invite(page: Page, recipient: Page, name: string) {
  const leave = page.getByRole('button', {
    name: 'Leave game · keep your match',
  });
  if (await leave.isVisible()) {
    await leave.click();
    await expect(page.locator('.arcade-outcome')).toContainText('left');
  }
  await page
    .locator('.arcade-panel .game-catalog button')
    .filter({ hasText: name })
    .click();
  await expect(
    recipient.getByRole('button', { name: 'Accept game', exact: true }),
  ).toBeVisible();
  await recipient
    .getByRole('button', { name: 'Accept game', exact: true })
    .click();
}
test('live matched users: Four in a Row, real-time board, winner and reconnect', async ({
  page,
  browser,
}, info) => {
  const context = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const recipient = await context.newPage();
    await paired(page, recipient);
    await invite(page, recipient, 'Four in a Row');
    await expect(
      recipient.getByRole('button', { name: 'Drop in column 1' }),
    ).toBeDisabled();
    for (const [n, col] of [1, 2, 1, 2, 1, 2, 1].entries()) {
      const actor = n % 2 === 0 ? page : recipient;
      await actor
        .getByRole('button', { name: `Drop in column ${col}` })
        .click();
      await expect(
        page.locator('.arcade-four span:not([data-piece="-1"])'),
      ).toHaveCount(n + 1);
      await expect(
        recipient.locator('.arcade-four span:not([data-piece="-1"])'),
      ).toHaveCount(n + 1);
      if (n === 1) {
        await recipient.reload();
        await openArcade(recipient, 'Maya');
        await expect(
          recipient.locator('.arcade-four span:not([data-piece="-1"])'),
        ).toHaveCount(2);
      }
    }
    await expect(page.locator('.arcade-outcome')).toContainText('You won');
    await expect(recipient.locator('.arcade-outcome')).toContainText(
      'Maya won',
    );
    await info.attach('two-authenticated-players-winner', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await info.attach('recipient-winner', {
      body: await recipient.screenshot(),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
test('live matched users: Bubble Duel updates opponent score and shared timed result', async ({
  page,
  browser,
}, info) => {
  const context = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const recipient = await context.newPage();
    await paired(page, recipient);
    await invite(page, recipient, 'Bubble Duel');
    await expect(page.locator('.arcade-bubbles button')).toHaveCount(30);
    await expect(recipient.locator('.arcade-bubbles button')).toHaveCount(30);
    const coloursA = await page
      .locator('.arcade-bubbles button')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-colour')));
    const coloursB = await recipient
      .locator('.arcade-bubbles button')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-colour')));
    expect(coloursA).toEqual(coloursB);
    await page
      .getByRole('button', { name: 'Pop bubble 1', exact: true })
      .click();
    await expect(page.locator('.arcade-scores')).not.toContainText('You: 0');
    await expect(recipient.locator('.arcade-scores')).not.toContainText(
      'Maya: 0',
    );
    await expect(page.locator('.arcade-outcome')).toContainText('You won', {
      timeout: 55000,
    });
    await expect(recipient.locator('.arcade-outcome')).toContainText(
      'Maya won',
    );
    await info.attach('bubble-duel-live-score', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
test('live matched users: Guess Next hides locked prediction, reveals five rounds on both clients', async ({
  page,
  browser,
}, info) => {
  const context = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const recipient = await context.newPage();
    await paired(page, recipient);
    await invite(page, recipient, 'Guess Next');
    for (let n = 0; n < 5; n++) {
      await page.getByRole('button', { name: 'Coral ●', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Blue ◆', exact: true }),
      ).toBeDisabled();
      await expect(recipient.locator('.arcade-results li')).toHaveCount(n);
      await recipient
        .getByRole('button', { name: 'Blue ◆', exact: true })
        .click();
      await expect(page.locator('.arcade-results li')).toHaveCount(n + 1);
      await expect(recipient.locator('.arcade-results li')).toHaveCount(n + 1);
    }
    await expect(page.locator('.arcade-outcome')).toBeVisible();
    await expect(recipient.locator('.arcade-outcome')).toBeVisible();
    const scores = await page.locator('.arcade-scores b').allTextContents();
    expect(scores.map(Number).reduce((a, b) => a + b, 0)).toBe(5);
    await info.attach('guess-next-results', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page
      .locator('.arcade-panel .game-catalog button')
      .filter({ hasText: 'Four in a Row' })
      .click();
    await recipient
      .getByRole('button', { name: 'Not now', exact: true })
      .click();
    await expect(page.locator('.arcade-outcome')).toContainText('declined');
    await invite(page, recipient, 'Guess Next');
    await recipient
      .getByRole('button', { name: 'Leave game · keep your match' })
      .click();
    await expect(page.locator('.arcade-outcome')).toContainText('left');
    expect((await page.request.get('/api/conversations')).ok()).toBe(true);
  } finally {
    await context.close();
  }
});
test('live gateway rejects unauthenticated and nonparticipant users', async ({
  page,
}) => {
  const response = await page.request.get(
    `/api/arcade/live?conversationId=${chatId}`,
  );
  expect(response.status()).toBe(426);
  // Browser handshakes carry a genuine Origin; neither headers nor conversation IDs grant access.
  await page.goto('/');
  const denied = () =>
    page.evaluate(
      (id) =>
        new Promise<boolean>((resolve) => {
          const ws = new WebSocket(
            `ws://${location.host}/api/arcade/live?conversationId=${id}`,
          );
          ws.onopen = () => {
            ws.close();
            resolve(false);
          };
          ws.onerror = () => resolve(true);
        }),
      chatId,
    );
  expect(await denied()).toBe(true);
  await loginSynthetic(page, 3);
  expect(await denied()).toBe(true);
});
async function rawMove(
  page: Page,
  action: string,
  position: number,
  stale = false,
) {
  return page.evaluate(
    ({ id, action, position, stale }) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const ws = new WebSocket(
          `ws://${location.host}/api/arcade/live?conversationId=${id}`,
        );
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('Live response timed out'));
        }, 8000);
        let sent = false;
        let initialRevision = -1;
        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (!sent && message.type === 'state') {
            sent = true;
            initialRevision = message.revision;
            ws.send(
              JSON.stringify({
                action,
                position,
                revision: message.revision - (stale ? 1 : 0),
                sessionId: message.game.id,
                round: message.game.results.length,
                moveId: crypto.randomUUID(),
              }),
            );
          } else if (
            sent &&
            (message.type === 'error' || message.revision > initialRevision)
          ) {
            clearTimeout(timer);
            ws.close();
            resolve(message);
          }
        };
        ws.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Handshake failed'));
        };
      }),
    { id: chatId, action, position, stale },
  );
}
test('authoritative live server rejects forged out-of-turn, stale and invalid moves', async ({
  page,
  browser,
}, info) => {
  const context = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const recipient = await context.newPage();
    await paired(page, recipient);
    await invite(page, recipient, 'Four in a Row');
    expect((await rawMove(recipient, 'drop', 0)).error).toContain('turn');
    expect((await rawMove(page, 'drop', 0)).type).toBe('state');
    await expect(
      recipient.locator('.arcade-four span:not([data-piece="-1"])'),
    ).toHaveCount(1);
    expect((await rawMove(recipient, 'drop', 1, true)).error).toContain(
      'changed',
    );
    expect((await rawMove(recipient, 'drop', 9)).error).toContain('column');
    await expect(
      page.locator('.arcade-four span:not([data-piece="-1"])'),
    ).toHaveCount(1);
    await page
      .getByRole('button', { name: 'Leave game · keep your match' })
      .click();
    await expect(page.locator('.arcade-outcome')).toContainText('left');
    await invite(page, recipient, 'Guess Next');
    await Promise.all([
      page.getByRole('button', { name: 'Coral ●', exact: true }).click(),
      recipient.getByRole('button', { name: 'Blue ◆', exact: true }).click(),
    ]);
    await expect(page.locator('.arcade-results li')).toHaveCount(1);
    await expect(recipient.locator('.arcade-results li')).toHaveCount(1);
    await page
      .getByRole('button', { name: 'Leave game · keep your match' })
      .click();
    await info.attach('simultaneous-predictions', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});
test('blocking a different matched user terminates an already-open live game', async ({
  page,
  browser,
}, info) => {
  const number = info.project.name === 'ios-mobile' ? 3 : 4,
    partner = number === 3 ? 'Lena' : 'Mateo';
  const context = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const recipient = await context.newPage();
    await loginSynthetic(page, 1);
    await loginSynthetic(recipient, number);
    await openArcade(page, partner);
    await openArcade(recipient, 'Maya');
    await invite(page, recipient, 'Four in a Row');
    const block = await recipient.request.post('/api/safety', {
      data: { targetUserId: 'test-001', action: 'block' },
    });
    expect(block.ok()).toBe(true);
    await page.getByRole('button', { name: 'Drop in column 1' }).click();
    await expect(page.locator('.games-error')).toContainText(
      'no longer available',
    );
    await expect(recipient.locator('.games-error')).toContainText(
      'no longer available',
    );
    const chats = await recipient.request.get('/api/conversations');
    expect(
      (await chats.json()).conversations.some(
        (c: { other_user_id: string }) => c.other_user_id === 'test-001',
      ),
    ).toBe(false);
  } finally {
    await context.close();
  }
});
test('Conversation tab regression: three private rounds across real authenticated accounts', async ({
  page,
  browser,
}, info) => {
  const context = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const recipient = await context.newPage();
    await paired(page, recipient);
    await page
      .getByRole('button', { name: 'Conversation', exact: true })
      .click();
    await recipient
      .getByRole('button', { name: 'Conversation', exact: true })
      .click();
    const savedConversation = await page.request.get(
      `/api/conversations/${chatId}/games`,
    );
    const savedStatus = (await savedConversation.json()).game?.session.status;
    if (savedStatus === 'completed') {
      await page
        .getByRole('button', { name: 'Browse games', exact: true })
        .click();
    } else if (savedStatus === 'waiting' || savedStatus === 'active') {
      await page
        .getByRole('button', { name: 'Leave game · keep your match' })
        .click();
    }
    await expect(page.locator('.game-catalog button')).toHaveCount(10);
    await page
      .locator('.game-catalog button')
      .filter({ hasText: 'This or That' })
      .click();
    await recipient
      .getByRole('button', { name: 'Accept game', exact: true })
      .click();
    for (let n = 0; n < 3; n++) {
      await expect(page.locator('.game-progress')).toContainText(
        `Round ${n + 1}`,
      );
      await page.locator('.game-options button').first().click();
      await page.getByRole('button', { name: 'Lock my answer' }).click();
      await expect(page.getByRole('dialog')).toContainText('Answer saved');
      const privateView = await recipient.request.get(
        `/api/conversations/${chatId}/games`,
      );
      expect((await privateView.json()).game.reveals).toHaveLength(n);
      await expect(recipient.locator('.game-progress')).toContainText(
        `Round ${n + 1}`,
      );
      await recipient.locator('.game-options button').first().click();
      await recipient.getByRole('button', { name: 'Lock my answer' }).click();
      await expect(page.locator('.game-reveals article')).toHaveCount(n + 1);
      await expect(recipient.locator('.game-reveals article')).toHaveCount(
        n + 1,
      );
    }
    await expect(
      page.getByRole('button', { name: 'Continue chatting', exact: true }),
    ).toBeVisible();
    await expect(
      recipient.getByRole('button', { name: 'Continue chatting', exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
