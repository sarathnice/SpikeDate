import { expect, test, type Page } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test.skip(
  ({ baseURL }) => !baseURL || new URL(baseURL).port !== '3007',
  'Uses dedicated local synthetic chat fixtures only.',
);

async function inbox(page: Page) {
  await loginSynthetic(page, 1);
  await page.getByRole('button', { name: /^Chat/ }).click();
  await expect(page.locator('.midnight-chat.chat-screen')).toBeVisible();
}
async function conversation(page: Page) {
  await inbox(page);
  await page
    .getByRole('button', { name: 'Chat with Lena', exact: true })
    .click();
  await expect(page.locator('.thread.midnight-chat')).toBeVisible();
}

test('A inbox: approved palette, typography, search and unread filtering', async ({
  page,
}, info) => {
  await inbox(page);
  await expect(page.locator('.chat-page-header')).toContainText(
    'YOUR CONNECTIONS',
  );
  const styles = await page.locator('.chat-screen').evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    font: getComputedStyle(el).fontFamily,
  }));
  expect(styles.background).toBe('rgb(16, 17, 27)');
  expect(styles.font).toContain('Inter');
  await page.getByLabel('Search chats').fill('Lena');
  await expect(page.locator('.chat-row')).toHaveCount(1);
  await page.getByLabel('Search chats').fill('no-such-connection');
  await expect(page.locator('.chat-empty-state')).toContainText(
    'No conversations found',
  );
  await page.getByLabel('Search chats').fill('');
  await page
    .locator('.chat-inbox-filters button')
    .filter({ hasText: 'Unread' })
    .click();
  for (const row of await page.locator('.chat-row').all())
    await expect(row.locator('.chat-meta b')).toBeVisible();
  await page
    .locator('.chat-inbox-filters button')
    .filter({ hasText: 'All' })
    .click();
  await expect(
    page.locator('.chat-row').filter({ hasText: 'Lena' }),
  ).toBeVisible();
  await info.attach('A-inbox', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

for (const width of [320, 390, 430, 1024]) {
  test(`A conversation ${width}px: composer, tools, games and header fit`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await conversation(page);
    await expect(page.locator('.chat-quick-tools')).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Send message', exact: true }),
    ).toBeDisabled();
    await page
      .getByRole('button', { name: 'Games and date plans', exact: true })
      .click();
    await expect(page.locator('.play-together-button')).toBeVisible();
    await page.locator('.play-together-button').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Plan a date', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Games and date plans', exact: true })
      .click();
    await page.locator('.composer input').fill('Checking the new chat layout');
    await expect(
      page.getByRole('button', { name: 'Send message', exact: true }),
    ).toBeEnabled();
    const layout = await page.locator('.thread').evaluate((el) => {
      const composer = el.querySelector('.composer')!.getBoundingClientRect();
      const header = el
        .querySelector('.thread-header')!
        .getBoundingClientRect();
      return {
        overflow: el.scrollWidth > el.clientWidth + 1,
        composerBottom: composer.bottom,
        viewportBottom: window.innerHeight,
        headerWidth: header.width,
        screenWidth: window.innerWidth,
      };
    });
    expect(layout.overflow).toBe(false);
    expect(layout.composerBottom).toBeLessThanOrEqual(layout.viewportBottom);
    await expect(page.locator('.tabbar')).toHaveCount(0);
    await expect(page.locator('.global-boost-button')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Safety options', exact: true }),
    ).toBeVisible();
    await info.attach(`A-conversation-${width}`, {
      body: await page.screenshot({
        path: `outputs/chat-midnight-${info.project.name}-${width}.png`,
      }),
      contentType: 'image/png',
    });
    await page
      .getByRole('button', { name: 'Back to chats', exact: true })
      .click();
    await expect(page.locator('.chat-screen')).toBeVisible();
    await expect(page.locator('.tabbar')).toBeVisible();
    await page
      .locator('.chat-row')
      .filter({ hasText: 'Lena' })
      .getByRole('button', { name: "Open Lena's full profile", exact: true })
      .click();
    await expect(page.locator('.profile-sheet')).toBeVisible();
  });
}

test('A sending: UI sends once, persists and reaches a separate matched login', async ({
  page,
  browser,
}, info) => {
  const note = `Midnight chat QA ${info.project.name} ${Date.now()}`;
  await conversation(page);
  await page.locator('.composer input').fill(note);
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('/messages') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await expect(
    page.locator('.mine .bubble').filter({ hasText: note }),
  ).toHaveCount(1);
  await expect(page.locator('.composer input')).toHaveValue('');
  const context = await browser.newContext({
    ...info.project.use,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const recipient = await context.newPage();
    await loginSynthetic(recipient, 3);
    await recipient.getByRole('button', { name: /^Chat/ }).click();
    await recipient
      .getByRole('button', { name: 'Chat with Maya', exact: true })
      .click();
    await expect(
      recipient
        .locator('.bubble-wrap:not(.mine) .bubble')
        .filter({ hasText: note }),
    ).toHaveCount(1);
    await info.attach('separate-recipient', {
      body: await recipient.screenshot(),
      contentType: 'image/png',
    });
  } finally {
    await context.close();
  }
});

test('A loading: delayed history cannot overwrite a newly composed message', async ({
  page,
}) => {
  await inbox(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/conversations/*/messages', async (route) => {
    if (route.request().method() === 'GET') await held;
    await route.continue();
  });
  try {
    await page
      .getByRole('button', { name: 'Chat with Lena', exact: true })
      .click();
    await expect(page.locator('.thread')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.composer input')).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Send message', exact: true }),
    ).toBeDisabled();
    release();
    await expect(page.locator('.thread')).toHaveAttribute('aria-busy', 'false');
    await page.locator('.composer input').fill('Ready after history loads');
    await expect(
      page.getByRole('button', { name: 'Send message', exact: true }),
    ).toBeEnabled();
    const bubble = await page
      .locator('.bubble')
      .first()
      .evaluate((el) => ({
        size: getComputedStyle(el).fontSize,
        weight: getComputedStyle(el).fontWeight,
      }));
    expect(bubble).toEqual({ size: '14px', weight: '400' });
  } finally {
    release();
  }
});

test('A existing actions: safety, Boost and date plan open and close', async ({
  page,
}) => {
  await conversation(page);
  await expect(page.locator('.thread')).toHaveAttribute('aria-busy', 'false');
  for (const name of ['Safety options', 'Lift my profile']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Close/ })
      .click();
    await expect(page.locator('.composer input')).toBeVisible();
  }
  await page
    .getByRole('button', { name: 'Games and date plans', exact: true })
    .click();
  await page.getByRole('button', { name: 'Plan a date', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Close/ })
    .click();
  await expect(page.locator('.thread')).toBeVisible();
});
