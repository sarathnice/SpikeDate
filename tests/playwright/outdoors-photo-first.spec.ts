import { expect, test } from '@playwright/test';
import { galaxyRoomNames } from '../../lib/galaxy-rooms';
import { loginSynthetic } from '../qa/ui-helpers';

test('Outdoors uses an edge-to-edge portrait with reachable overlay actions', async ({
  page,
}) => {
  await loginSynthetic(page, 1);
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  await page.locator('.room-tile').filter({ hasText: 'Outdoors' }).click();

  const room = page.locator('.room-stack.photo-first-room');
  await expect(room).toBeVisible();
  await expect(room.locator('.context-chip')).toHaveCount(0);
  await expect(room.locator('.room-header strong')).toHaveText('Outdoors');
  const portrait = room.locator('.cinematic-photo-main');
  await expect(portrait).toBeVisible();
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>(
      '.photo-first-room .cinematic-photo-main',
    );
    return Boolean(image?.complete && image.naturalWidth > 0);
  });
  await expect(portrait).toHaveCSS('object-fit', 'cover');
  const visibleDetails = room.locator('.chips span:visible');
  await expect(visibleDetails.first()).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await expect(visibleDetails.first()).toHaveCSS('border-top-style', 'none');
  await expect(visibleDetails.first()).toHaveCSS('font-weight', '400');
  if ((await visibleDetails.count()) > 1) {
    expect(
      await visibleDetails
        .nth(1)
        .evaluate((element) =>
          getComputedStyle(element, '::before').content.replaceAll('"', ''),
        ),
    ).toBe('·');
  }

  for (const { width, height } of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const rect = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect().toJSON();
      return {
        frame: rect('.phone-frame'),
        card: rect('.photo-first-room .profile-card'),
        nav: rect('.tabbar'),
        rail: rect('.photo-first-room .room-action-wrap'),
        info: rect('.photo-first-room .card-content'),
      };
    });
    expect(layout.frame).toBeTruthy();
    expect(layout.card).toBeTruthy();
    expect(layout.nav).toBeTruthy();
    expect(layout.rail).toBeTruthy();
    expect(layout.info).toBeTruthy();
    expect(Math.abs(layout.card!.y - layout.frame!.y)).toBeLessThanOrEqual(2);
    expect(
      Math.abs(layout.card!.width - layout.frame!.width),
    ).toBeLessThanOrEqual(2);
    expect(Math.abs(layout.card!.bottom - layout.nav!.y)).toBeLessThanOrEqual(
      2,
    );
    expect(layout.rail!.bottom).toBeLessThan(layout.nav!.y);
    expect(layout.info!.right).toBeLessThan(layout.rail!.x);
    expect(layout.rail!.right).toBeLessThanOrEqual(width);
    expect(await room.getByRole('button', { name: 'Pass' }).isVisible()).toBe(
      true,
    );
    expect(await room.getByRole('button', { name: 'Like' }).isVisible()).toBe(
      true,
    );
    expect(
      await room
        .getByRole('button', { name: 'Send a Spike introduction' })
        .isVisible(),
    ).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await room.locator('.profile-card-open').click();
  await expect(page.locator('.profile-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'Close full profile' }).click();
  await room.getByRole('button', { name: 'Send a Spike introduction' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await room.getByRole('button', { name: 'Back to Galaxy' }).click();
  await expect(page.locator('.explore-hub')).toBeVisible();
});

test('every populated Galaxy Browse tile uses the photo-first room layout', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loginSynthetic(page, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  const hub = page.locator('.explore-hub');
  let populatedRooms = 0;

  for (const name of galaxyRoomNames) {
    await hub
      .locator('.room-tile')
      .filter({ has: page.locator('strong', { hasText: name }) })
      .click();
    const room = page.locator('.room-stack');
    await expect(room.locator('.room-header strong')).toHaveText(name);
    await expect(room.locator('.room-header span').first()).not.toContainText(
      'Checking',
    );

    if (await room.locator('.room-empty').isVisible()) {
      await expect(room).not.toHaveClass(/photo-first-room/);
      await expect(room.locator('.context-chip')).toBeVisible();
    } else {
      populatedRooms += 1;
      await expect(room).toHaveClass(/photo-first-room/);
      await expect(room.locator('.context-chip')).toHaveCount(0);
      const visibleDetails = room.locator('.chips span:visible');
      await expect(visibleDetails.first()).toHaveCSS(
        'background-color',
        'rgba(0, 0, 0, 0)',
      );
      await expect(visibleDetails.first()).toHaveCSS(
        'border-top-style',
        'none',
      );
      const portrait = room.locator('.cinematic-photo-main');
      await expect(portrait).toHaveCSS('object-fit', 'cover');
      await page.waitForFunction(() => {
        const image = document.querySelector<HTMLImageElement>(
          '.photo-first-room .cinematic-photo-main',
        );
        return Boolean(image?.complete && image.naturalWidth > 0);
      });
      const layout = await page.evaluate(() => {
        const rect = (selector: string) =>
          document.querySelector(selector)?.getBoundingClientRect().toJSON();
        return {
          frame: rect('.phone-frame'),
          card: rect('.photo-first-room .profile-card'),
          nav: rect('.tabbar'),
          rail: rect('.photo-first-room .room-action-wrap'),
        };
      });
      expect(Math.abs(layout.card!.y - layout.frame!.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(layout.card!.bottom - layout.nav!.y)).toBeLessThanOrEqual(
        2,
      );
      expect(layout.rail!.bottom).toBeLessThan(layout.nav!.y);
      await expect(room.getByRole('button', { name: 'Pass' })).toBeVisible();
      await expect(room.getByRole('button', { name: 'Like' })).toBeVisible();
      await expect(
        room.getByRole('button', { name: 'Send a Spike introduction' }),
      ).toBeVisible();
    }

    await room.getByRole('button', { name: 'Back to Galaxy' }).click();
    await expect(hub).toBeVisible();
  }

  expect(populatedRooms).toBeGreaterThan(0);
});
