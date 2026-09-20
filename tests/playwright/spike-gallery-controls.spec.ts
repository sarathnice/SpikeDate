import { test, expect } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test('mobile: Spike star, contained availability switch, own photos and full gallery', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await loginSynthetic(page, 1);
  await expect(
    page.locator('.home-action-rail .spark .spike-intro-star'),
  ).toBeVisible();
  await expect(
    page.locator('.home-action-rail .spark .spike-intro-plus'),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Post or edit your Today update' })
    .first()
    .click();
  const toggle = page.getByRole('switch', { name: 'Available tonight' });
  for (const checked of [true, false]) {
    await toggle.setChecked(checked);
    await expect(toggle).toHaveAttribute('aria-checked', String(checked));
    await page.waitForTimeout(300);
    const geometry = await toggle.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const thumb = el
        .querySelector('[data-slot="switch-thumb"]')!
        .getBoundingClientRect();
      const row = el.parentElement!.getBoundingClientRect();
      return {
        thumbFits:
          thumb.left >= box.left &&
          thumb.right <= box.right + 1 &&
          thumb.top >= box.top &&
          thumb.bottom <= box.bottom + 1,
        rowFits: box.left >= row.left && box.right <= row.right + 1,
      };
    });
    expect(geometry).toEqual({ thumbFits: true, rowFits: true });
  }
  await page.getByRole('button', { name: 'Close Today composer' }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  const photos = page.getByRole('region', { name: 'Your profile photos' });
  await expect(photos.locator('.own-photo-grid img').first()).toBeVisible();
  const photoCount = await photos.locator('.own-photo-grid img').count();
  expect(photoCount).toBeGreaterThanOrEqual(1);
  expect(photoCount).toBeLessThanOrEqual(6);
  await expect(photos).toContainText(`${photoCount} of 6 photos`);
  await photos
    .getByRole('button', { name: 'Edit photos', exact: true })
    .click();
  await expect(page.locator('.registration-dialog')).toBeVisible();
  await expect(page.locator('.profile-media-tile')).toHaveCount(photoCount);
  await page.getByRole('button', { name: 'Close registration' }).click();
  await page.getByRole('button', { name: 'Preview my profile card' }).click();
  await page
    .getByRole('button', { name: 'Open your full profile preview' })
    .click();
  const full = page.locator('.profile-preview-sheet');
  await expect(full.locator('.profile-photo-strip button')).toHaveCount(
    photoCount > 1 ? photoCount : 0,
  );
  await expect(full.locator('.film-count')).toContainText(`1 / ${photoCount}`);
  const image = full.locator('.cinematic-photo-main');
  if (photoCount > 1) {
    const initial = await image.getAttribute('src');
    await full.getByRole('button', { name: 'Next profile photo' }).click();
    await expect(full.locator('.film-count')).toContainText(`2 / ${photoCount}`);
    await expect(image).not.toHaveAttribute('src', initial!);
  }
  if (photoCount > 2) {
    await full.getByRole('button', { name: 'View profile photo 3' }).click();
    await expect(full.locator('.film-count')).toContainText(`3 / ${photoCount}`);
  }
  await expect
    .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await info.attach('full-gallery-mobile', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.getByRole('button', { name: 'Close full profile' }).click();
  await page.getByRole('button', { name: 'Back to profile' }).click();
  await photos.scrollIntoViewIfNeeded();
  await info.attach('own-photo-section', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});
