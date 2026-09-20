import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test('communication settings: grouping, readable switches and reversible preferences', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await loginSynthetic(page, info.project.name === 'android-mobile' ? 43 : 42);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  const group = page.locator('.communication-settings');
  await expect(
    group.getByRole('heading', { name: 'Notifications & reminders' }),
  ).toBeVisible();
  await expect(group.locator('.push-settings-card')).toHaveCSS('order', '1');
  await expect(group.locator('.engagement-settings-card')).toHaveCSS(
    'order',
    '2',
  );
  const notifications = group.locator('.push-settings-card');
  const reminders = group.locator('.engagement-settings-card');
  await expect(notifications).not.toHaveAttribute('open', '');
  await expect(reminders).not.toHaveAttribute('open', '');
  await expect(group.getByRole('switch').first()).not.toBeVisible();
  await notifications.locator(':scope > summary').click();
  await reminders.locator(':scope > summary').click();
  await expect(group.locator('.push-setting-toggle')).toHaveCount(6);
  expect(
    await group.locator(':scope > details').first().getAttribute('class'),
  ).toBe('push-settings-card communication-disclosure');
  await expect(group.locator('.engagement-setting-toggle')).toHaveCount(4);
  for (const row of await group
    .locator('.push-setting-toggle,.engagement-setting-toggle')
    .all()) {
    await row.scrollIntoViewIfNeeded();
    const text = (await row.locator('strong').boundingBox())!;
    const toggle = (await row.getByRole('switch').boundingBox())!;
    expect(toggle.width).toBe(38);
    expect(text.x + text.width).toBeLessThanOrEqual(toggle.x);
    await expect(row.locator('p')).toHaveCSS('font-weight', '400');
    await expect(row.locator('p')).toHaveCSS('font-size', '12px');
    const control = row.getByRole('switch');
    const original = await control.getAttribute('aria-checked');
    try {
      for (const checked of [false, true]) {
        await control.setChecked(checked);
        await page.waitForTimeout(200);
        const fits = await control.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const thumb = element
            .querySelector('[data-slot="switch-thumb"]')!
            .getBoundingClientRect();
          const row = element.parentElement!.getBoundingClientRect();
          return (
            thumb.left >= box.left &&
            thumb.right <= box.right + 1 &&
            thumb.top >= box.top &&
            thumb.bottom <= box.bottom + 1 &&
            box.right <= row.right + 1 &&
            box.right <= window.innerWidth
          );
        });
        expect(fits).toBe(true);
      }
    } finally {
      await control.setChecked(original === 'true');
    }
  }
  const pref = group.getByRole('switch', {
    name: 'Enable New matches notifications',
    exact: true,
  });
  const original = await pref.getAttribute('aria-checked');
  try {
    await pref.click();
    await expect(pref).toHaveAttribute(
      'aria-checked',
      original === 'true' ? 'false' : 'true',
    );
  } finally {
    if ((await pref.getAttribute('aria-checked')) !== original)
      await pref.click();
  }
  await info.attach('organized-settings', {
    body: await group.screenshot(),
    contentType: 'image/png',
  });
  await notifications.locator(':scope > summary').click();
  await reminders.locator(':scope > summary').click();
  await expect(pref).not.toBeVisible();
  await notifications.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  await expect(pref).toBeVisible();
});
