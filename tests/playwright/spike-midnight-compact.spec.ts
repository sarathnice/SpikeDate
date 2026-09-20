import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test.skip(
  ({ baseURL }) =>
    !baseURL ||
    !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname) ||
    new URL(baseURL).port !== '3007',
  'Synthetic chat fixtures only in the dedicated local runtime.',
);

test('A3: compact grouping, one receipt, vertical history and stable composer at keyboard-sized height', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginSynthetic(page, 1);
  const response = await page.request.get('/api/conversations');
  const body = await response.json();
  const chat = body.conversations.find(
    (entry: { display_name: string }) => entry.display_name === 'Lena',
  );
  expect(chat?.id).toBeTruthy();
  for (let index = 0; index < 12; index++) {
    const saved = await page.request.post(
      `/api/conversations/${chat.id}/messages`,
      {
        data: {
          body: `Compact QA ${index + 1}: Coffee, a walk and a beautiful view. What would your ideal weekend look like?`,
          clientId: `compact-qa-${info.project.name}-${Date.now()}-${index}`,
        },
      },
    );
    expect(saved.ok()).toBe(true);
  }
  await page.getByRole('button', { name: /^Chat/ }).click();
  await page
    .getByRole('button', { name: 'Chat with Lena', exact: true })
    .click();
  await expect(page.locator('.thread')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.tabbar')).toHaveCount(0);
  await expect(page.locator('.message-status')).toHaveCount(1);
  await expect(page.locator('.bubble-wrap > button:not(.bubble)')).toHaveCount(
    0,
  );
  expect(await page.locator('.message-grouped').count()).toBeGreaterThan(0);
  const measurements = await page.locator('.thread').evaluate((thread) => {
    const history = thread.querySelector('.message-body') as HTMLElement;
    const composer = thread.querySelector('.composer')!;
    const before = composer.getBoundingClientRect().top;
    const bottom = history.scrollTop;
    history.scrollTop = 0;
    return {
      scrollable: history.scrollHeight > history.clientHeight,
      startedAtBottom: bottom > 0,
      stable: composer.getBoundingClientRect().top === before,
      scrollbar: getComputedStyle(history).scrollbarWidth,
      overflow: history.scrollWidth > history.clientWidth,
      headerHeight: thread
        .querySelector('.thread-header')!
        .getBoundingClientRect().height,
    };
  });
  expect(measurements).toMatchObject({
    scrollable: true,
    startedAtBottom: true,
    stable: true,
    scrollbar: 'none',
    overflow: false,
  });
  expect(measurements.headerHeight).toBeLessThanOrEqual(64);
  await expect
    .poll(() => page.locator('.message-body').evaluate((el) => el.scrollTop))
    .toBe(0);
  await page
    .getByRole('button', { name: 'Games and date plans', exact: true })
    .click();
  await expect
    .poll(() => page.locator('.message-body').evaluate((el) => el.scrollTop))
    .toBe(0);
  await page
    .getByRole('button', { name: 'Games and date plans', exact: true })
    .click();
  await page.locator('.message-body').hover();
  await page.mouse.wheel(0, 500);
  await expect
    .poll(() => page.locator('.message-body').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await page.locator('.message-body').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page
    .getByRole('button', { name: /Message options: Compact QA 12/ })
    .last()
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Message options', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await page.locator('.composer input').fill('A3 composer stays in place');
  const focusRing = await page
    .locator('.chat-compose-field')
    .evaluate((el) => ({
      width: getComputedStyle(el).outlineWidth,
      color: getComputedStyle(el).outlineColor,
    }));
  expect(focusRing).toEqual({ width: '2px', color: 'rgb(255, 128, 91)' });
  await page.screenshot({
    path: `outputs/spike-midnight-${info.project.name}.png`,
  });
  await page.setViewportSize({ width: 390, height: 480 });
  await expect
    .poll(() =>
      page
        .locator('.composer')
        .evaluate((el) => el.getBoundingClientRect().bottom),
    )
    .toBeLessThanOrEqual(480);
  await expect(page.locator('.composer input')).toBeVisible();
  await page
    .getByRole('button', { name: 'Games and date plans', exact: true })
    .click();
  await expect(page.locator('.play-together-button')).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.composer')
        .evaluate((el) => el.getBoundingClientRect().bottom),
    )
    .toBeLessThanOrEqual(480);
  await page
    .getByRole('button', { name: 'Back to chats', exact: true })
    .click();
  await expect(page.locator('.tabbar')).toBeVisible();
});
