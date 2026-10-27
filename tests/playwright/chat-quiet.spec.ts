import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.skip(
  ({ baseURL }) => !['http://127.0.0.1:3007', 'https://spikedate-stage.sarathnice.workers.dev'].includes(baseURL ?? ''),
  'Dedicated local or staging fixtures only.',
);
test('Quiet Reactions: emoji, editable ideas, persistence, remove and failure feedback', async ({
  page,
  baseURL,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let reactions: Array<{
    message_id: string;
    emoji: string;
    count: number;
    mine: number;
  }> = [];
  let writes = 0,
    fail = false;
  // Isolate UI tests from real conversations and avoid sending member messages.
  await page.route('**/api/conversations', (route) =>
    route.fulfill({
      json: {
        conversations: [
          {
            id: 'quiet-ui-fixture',
            other_user_id: 'quiet-partner',
            display_name: 'Quiet QA',
            unread_count: 0,
            preview: 'Live jazz and coffee',
            verification_status: 'unverified',
          },
        ],
      },
    }),
  );
  await page.route('**/api/conversations/quiet-ui-fixture/messages', (route) =>
    route.fulfill({
      json: {
        messages: [
          {
            id: 'quiet-message',
            sender_id: 'quiet-partner',
            body: 'Live jazz and coffee — my kind of evening 😊',
            delivered_at: 1,
            read_at: 1,
            media_kind: null,
          },
        ],
      },
    }),
  );
  await page.route(
    '**/api/conversations/quiet-ui-fixture/reactions',
    async (route) => {
      if (route.request().method() === 'PUT') {
        writes++;
        if (fail)
          return route.fulfill({
            status: 503,
            json: { error: 'Test failure' },
          });
        const { emoji } = route.request().postDataJSON();
        reactions = emoji
          ? [{ message_id: 'quiet-message', emoji, count: 1, mine: 1 }]
          : [];
      }
      return route.fulfill({ json: { reactions } });
    },
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  if (baseURL?.includes('workers.dev')) {
    const credentials = JSON.parse(readFileSync('outputs/qa/profile-import/login.json', 'utf8'));
    await page.getByLabel('Email', { exact: true }).fill('demo101@spikedate.test');
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  } else {
    await page.getByLabel('Test profile').selectOption('atlanta001@spikedate.test');
    await page.getByRole('button', { name: /Fill selected test login/i }).click();
  }
  await page
    .getByRole('button', { name: 'Sign in to SpikeDate', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Open Home tools', exact: true }),
  ).toBeVisible();
  // Probe the real deployed authorization boundary, outside the UI mocks.
  expect((await page.request.get('/api/conversations/quiet-no-access/reactions')).status()).toBe(404);
  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('button', { name: 'Chat', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Chat with Quiet QA', exact: true })
    .click();
  const thread = page.locator('.thread');
  await expect(thread).toHaveAttribute('aria-busy', 'false');
  const draft = thread.getByRole('textbox', {
    name: 'Message Quiet QA',
    exact: true,
  });
  let sends = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/messages')) sends++;
  });
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [430, 932],
  ]) {
    await page.setViewportSize({ width, height });
    await thread
      .getByRole('button', { name: 'Conversation ideas', exact: true })
      .click();
    await thread
      .getByRole('button', {
        name: 'What are you listening to lately?',
        exact: true,
      })
      .click();
    await expect(draft).toHaveValue('What are you listening to lately?');
    await thread
      .getByRole('button', { name: 'Emoji picker', exact: true })
      .click();
    await thread
      .getByRole('button', { name: 'Insert 😊', exact: true })
      .click();
    await expect(draft).toHaveValue(/😊$/);
    await page.keyboard.press('Escape');
    await thread
      .getByRole('button', { name: 'Conversation ideas', exact: true })
      .click();
    await thread
      .getByRole('button', {
        name: 'Who would you love to see live?',
        exact: true,
      })
      .click();
    await expect(draft).toHaveValue('What are you listening to lately?😊');
    await page.keyboard.press('Escape');
    await draft.fill('');
    await thread
      .getByRole('button', { name: 'React to message', exact: true })
      .click();
    await thread.getByRole('button', { name: 'React ❤️', exact: true }).click();
    const heart = thread.getByRole('button', {
      name: '❤️ reaction, 1, yours; remove',
      exact: true,
    });
    await expect(heart).toBeVisible();
    // Reopening the thread loads saved reactions rather than component-only state.
    await thread.getByRole('button', { name: 'Back to chats', exact: true }).click();
    await page.getByRole('button', { name: 'Chat with Quiet QA', exact: true }).click();
    await expect(heart).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const composer = await thread.locator('.composer').boundingBox();
    expect(composer!.y + composer!.height).toBeLessThanOrEqual(height);
    await info.attach(`quiet-chat-${width}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await heart.click();
    await expect(heart).toHaveCount(0);
  }
  fail = true;
  await thread
    .getByRole('button', { name: 'React to message', exact: true })
    .click();
  await thread.getByRole('button', { name: 'React 👍', exact: true }).click();
  await expect(
    page.getByText('Reaction not saved. Please try again.', { exact: true }),
  ).toBeVisible();
  expect(sends).toBe(0);
  expect(writes).toBe(7);
  expect(errors).toEqual([]);
});
