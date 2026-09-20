import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test('High-intent reminder is legible on mobile and opens the Spike composer', async ({
  page,
}, info) => {
  await loginSynthetic(page, 24);
  await page.locator('.profile-card-open').click({ position: { x: 80, y: 220 } });
  await expect(page.locator('.profile-sheet')).toBeVisible();
  await page.waitForTimeout(3100);
  await page.getByRole('button', { name: 'Close full profile' }).click();

  const reminder = page.locator('.engagement-prompt.super');
  await expect(reminder).toBeVisible();
  await expect(reminder).toContainText('HIGH-INTENT MOMENT');
  await expect(reminder.locator('.engagement-prompt-icon .spike-intro-star')).toBeVisible();
  await expect(reminder.locator('.engagement-prompt-icon .spike-intro-plus')).toBeVisible();
  await expect(reminder.getByRole('button', { name: 'Keep browsing' })).toHaveCount(0);
  await expect(reminder.getByRole('button', { name: 'Write an intro' })).toBeVisible();

  const bounds = await reminder.evaluate((element) => {
    const card = element.getBoundingClientRect();
    const frame = document.querySelector('.phone-frame')!.getBoundingClientRect();
    const nav = document.querySelector('.tabbar')!.getBoundingClientRect();
    const action = element.querySelector('.primary')!.getBoundingClientRect();
    return {
      withinFrame: card.left >= frame.left - 1 && card.right <= frame.right + 1,
      aboveNav: card.bottom <= nav.top + 1,
      actionWithinCard: action.bottom <= card.bottom + 1,
      overflow: element.scrollWidth - element.clientWidth,
    };
  });
  expect(bounds.withinFrame).toBe(true);
  expect(bounds.aboveNav).toBe(true);
  expect(bounds.actionWithinCard).toBe(true);
  expect(bounds.overflow).toBeLessThanOrEqual(1);

  await info.attach('high-intent-moment', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
  await reminder.getByRole('button', { name: 'Write an intro' }).click();
  await expect(page.locator('.note-dialog')).toBeVisible();
});
