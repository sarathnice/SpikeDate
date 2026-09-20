import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test('six-photo row stays compact, scrolls on narrow phones and keeps editing accessible', async ({
  page,
}, info) => {
  // UI-only six-photo fixture; do not add or overwrite stored profile photos.
  await page.route('**/api/profile', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const data = await response.json();
    const photo = data.media?.find(
      (item: { type: string }) => item.type === 'photo',
    );
    if (photo)
      data.media = Array.from({ length: 6 }, (_, position) => ({
        ...photo,
        id: `ui-photo-${position}`,
        position,
      }));
    await route.fulfill({ response, json: data });
  });
  await loginSynthetic(page, 42);
  await page.setViewportSize({ width: 320, height: 844 });
  await page
    .getByRole('button', { name: 'Post or edit your Today update' })
    .first()
    .click();
  const availability = page.getByRole('switch', { name: 'Available tonight' });
  for (const checked of [true, false]) {
    await availability.setChecked(checked);
    await page.waitForTimeout(200);
    expect(
      await availability.evaluate((element) => {
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
      }),
    ).toBe(true);
  }
  await page.getByRole('button', { name: 'Close Today composer' }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  const row = page.locator('.own-photo-grid');
  await expect(row.locator('img')).toHaveCount(6);
  for (const image of await row.locator('img').all()) {
    await expect
      .poll(() =>
        image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  }
  for (const width of [320, 390, 412]) {
    await page.setViewportSize({ width, height: 844 });
    await row.scrollIntoViewIfNeeded();
    const layout = await row.evaluate((element) => {
      const tiles = Array.from(element.querySelectorAll('button')).map(
        (button) => button.getBoundingClientRect(),
      );
      return {
        oneLine: tiles.every((tile) => Math.abs(tile.top - tiles[0].top) < 1),
        height: element.getBoundingClientRect().height,
        fits: element.getBoundingClientRect().right <= window.innerWidth,
        overflow: element.scrollWidth > element.clientWidth,
      };
    });
    expect(layout.oneLine).toBe(true);
    expect(layout.height).toBeLessThan(90);
    expect(layout.fits).toBe(true);
    if (width === 320) {
      expect(layout.overflow).toBe(true);
      await row.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      expect(
        await row.evaluate((element) => element.scrollLeft),
      ).toBeGreaterThan(0);
      await expect(
        row.getByRole('button', { name: 'Edit profile photo 6' }),
      ).toBeInViewport();
    }
  }
  await info.attach('compact-six-photos', {
    body: await row.screenshot(),
    contentType: 'image/png',
  });
  await page.getByRole('button', { name: 'Edit photos', exact: true }).click();
  await expect(page.locator('.registration-dialog')).toBeVisible();
});
