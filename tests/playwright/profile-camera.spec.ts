import { test, expect } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test.skip(
  ({ baseURL }) => !baseURL || !/localhost|127\.0\.0\.1/.test(baseURL),
  'Synthetic photo writes are local only.',
);

test('Guided Studio uses library-only profile photos', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await loginSynthetic(page, info.project.name === 'android-mobile' ? 23 : 22);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Edit photos' }).click();

  const studio = page.getByRole('region', { name: 'Profile photos' });
  await expect(studio.getByText('GUIDED STUDIO · PROFILE PHOTO')).toBeVisible();
  await expect(studio.getByText(/1\s*Upload/)).toBeVisible();
  await expect(studio.getByText(/2\s*Auto frame/)).toBeVisible();
  await expect(studio.getByText(/3\s*Review/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Take a profile photo', exact: true }),
  ).toHaveCount(0);
  await expect(studio.getByLabel('Add and crop profile photo')).toBeAttached();
});

test('photo framing: select a face in a group, or keep manual framing when no face is found', async ({
  page,
}, info) => {
  await loginSynthetic(page, info.project.name === 'android-mobile' ? 23 : 22);
  const group = await page.evaluate(async () => {
    const image = new window.Image();
    image.src = '/maya.png';
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 480;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#999';
    context.fillRect(0, 0, 480, 480);
    context.drawImage(image, 440, 260, 450, 500, 0, 90, 230, 280);
    context.drawImage(image, 440, 260, 450, 500, 250, 90, 230, 280);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Edit photos' }).click();
  await page.getByLabel('Add and crop profile photo').setInputFiles({
    name: 'qa-group.png',
    mimeType: 'image/png',
    buffer: Buffer.from(group, 'base64'),
  });
  const crop = page.locator('.photo-crop-dialog');
  await expect(
    crop.getByText('GUIDED STUDIO · AUTO FRAME', { exact: false }),
  ).toBeVisible();
  await expect(
    crop.locator('.photo-face-assistance [role="status"]'),
  ).toContainText('Tap your face below', { timeout: 30000 });
  await crop.getByRole('button', { name: 'Frame face 1', exact: true }).click();
  await expect(
    crop.locator('.photo-face-assistance [role="status"]'),
  ).toContainText('Face framing suggested');
  const first = await crop
    .locator('canvas.photo-crop-exact-preview')
    .evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  await crop.getByRole('button', { name: 'Frame face 2', exact: true }).click();
  await expect
    .poll(() =>
      crop
        .locator('canvas.photo-crop-exact-preview')
        .evaluate((el) => (el as HTMLCanvasElement).toDataURL()),
    )
    .not.toBe(first);
  await crop
    .getByRole('button', { name: 'Close photo editor', exact: true })
    .click();

  const blank = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 480;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#aaa';
    context.fillRect(0, 0, 480, 480);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Add and crop profile photo').setInputFiles({
    name: 'qa-blank.png',
    mimeType: 'image/png',
    buffer: Buffer.from(blank, 'base64'),
  });
  await expect(
    crop.locator('.photo-face-assistance [role="status"]'),
  ).toContainText('No clear face found', { timeout: 30000 });
  await expect(
    crop.getByRole('button', { name: 'Save photo', exact: true }),
  ).toBeEnabled();
  await crop
    .getByRole('button', { name: 'Close photo editor', exact: true })
    .click();
});
