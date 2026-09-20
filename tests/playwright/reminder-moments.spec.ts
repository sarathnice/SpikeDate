import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test('Grouped reminders preview all four Quiet cards without sending an action', async ({
  page,
}, info) => {
  await loginSynthetic(page, 32);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  const settings = page.locator('.engagement-settings-card');
  await settings.locator(':scope > summary').click();

  await expect(settings.getByText('SHOW UP', { exact: true })).toBeVisible();
  await expect(settings.getByText('MAKE A MOVE', { exact: true })).toBeVisible();
  for (const title of [
    'Share your Today',
    'Galaxy',
    'Send a Spike',
    'Use Profile Lift',
  ]) {
    await expect(
      settings.locator('.engagement-setting-toggle').getByText(title, { exact: true }),
    ).toBeVisible();
    await expect(settings.getByRole('switch', { name: `Enable ${title}` })).toBeVisible();
  }
  await expect(settings.locator('.reminder-setting-icon')).toHaveCount(4);
  await expect(settings.getByLabel('Today reminder time').locator('option')).toHaveCount(3);
  const spikeSwitch = settings.getByRole('switch', { name: 'Enable Send a Spike' });
  const originalSpikeSetting = await spikeSwitch.getAttribute('aria-checked');
  await spikeSwitch.click();
  await expect(spikeSwitch).toHaveAttribute('aria-checked', originalSpikeSetting === 'true' ? 'false' : 'true');
  await spikeSwitch.click();
  await expect(spikeSwitch).toHaveAttribute('aria-checked', originalSpikeSetting!);
  await settings.locator('.reminder-preview-disclosure > summary').click();
  const switcher = settings.getByRole('group', { name: 'Choose reminder preview' });
  const card = settings.locator('.reminder-preview-card');
  for (const [tab, heading] of [
    ['Today', 'Share one fresh moment'],
    ['Galaxy', '3 new people in Galaxy'],
    ['Spike', 'Maya stands out'],
    ['Lift', 'Be seen a little sooner'],
  ]) {
    await switcher.getByRole('button', { name: tab, exact: true }).click();
    await expect(switcher.getByRole('button', { name: tab, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(card).toContainText(heading);
    await expect(card.locator('.engagement-prompt-icon')).toBeVisible();
    await expect(card.locator('.primary')).toBeDisabled();
    const geometry = await card.evaluate((element) => {
      const cardBounds = element.getBoundingClientRect();
      const frameBounds = document.querySelector('.phone-frame')!.getBoundingClientRect();
      return {
        contained: cardBounds.left >= frameBounds.left - 1 && cardBounds.right <= frameBounds.right + 1,
        overflow: element.scrollWidth - element.clientWidth,
        position: getComputedStyle(element).position,
      };
    });
    expect(geometry.contained).toBe(true);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.position).toBe('static');
  }
  await page.locator('.profile-page').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const bottomClearance = await card.evaluate((element) => ({
    actionBottom: element.querySelector('.primary')!.getBoundingClientRect().bottom,
    navTop: document.querySelector('.tabbar')!.getBoundingClientRect().top,
  }));
  expect(bottomClearance.actionBottom).toBeLessThanOrEqual(bottomClearance.navTop + 1);
  await info.attach('grouped-reminders-quiet-card', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
});
