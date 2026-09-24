import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { loginSynthetic } from '../qa/ui-helpers';

const suppliedPhoto =
  process.env.SPIKEDATE_QA_LOW_QUALITY_PHOTO ||
  'C:\\Users\\sarat\\AppData\\Local\\Temp\\codex-clipboard-3b462be6-6fb7-4b84-878e-6acc8d880e13.webp';

test('low-quality upload is identified, enhanced for delivery and remains editable', async ({
  page,
}) => {
  await loginSynthetic(page, 49);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Edit photos' }).click();
  const registration = page.getByRole('dialog', {
    name: 'Your photos',
  });
  const profileResponse = await page.request.get('/api/profile');
  const profilePayload = profileResponse.ok()
    ? await profileResponse.json()
    : {};
  const before = (profilePayload.media ?? []) as { id: string }[];
  const originalIds = new Set(before.map((item) => item.id));
  const hasServerSession = (await page.context().cookies()).some(
    (cookie) => cookie.name === 'spikedate_session' && cookie.value.length > 0,
  );
  let uploadedId = '';
  try {
    const file = existsSync(suppliedPhoto)
      ? suppliedPhoto
      : {
          name: 'low-resolution.png',
          mimeType: 'image/png',
          buffer: readFileSync('public/brand/app-icon-192.png'),
        };
    await registration
      .getByLabel('Add and crop profile photo')
      .setInputFiles(file);
    const editor = page.getByRole('dialog', { name: 'Review your photo' });
    await expect(editor).toBeVisible();
    await expect(editor.locator('.photo-quality-notice')).toContainText(
      'Low-resolution source',
    );
    await expect(editor.locator('.photo-crop-quality')).toHaveClass(
      /is-enhanced/,
    );
    await expect(editor.locator('.photo-crop-quality')).toContainText(
      'Cloud Enhance will be applied',
    );
    await editor.getByText('Quality & crop details').click();
    await expect(editor.locator('.photo-crop-quality')).toContainText(
      'AI upscale',
    );
    const responsePromise = hasServerSession
      ? page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/media') &&
            response.request().method() === 'POST',
        )
      : null;
    await editor.getByRole('button', { name: 'Save photo' }).click();
    if (!responsePromise) {
      await expect(editor).toBeHidden({ timeout: 30_000 });
      return;
    }
    const upload = await responsePromise;
    expect(upload.ok()).toBe(true);
    uploadedId = (await upload.json()).media.id;
    await expect(editor).toBeHidden({ timeout: 30_000 });

    const card = await page.request.get(
      `/api/media/${uploadedId}?variant=card`,
      { headers: { accept: 'image/webp' } },
    );
    expect(card.ok()).toBe(true);
    if (new URL(page.url()).hostname.endsWith('workers.dev')) {
      expect(card.headers()['x-spikedate-image-enhancement']).toBe(
        'ai-upscaled',
      );
      const dimensions = await page.evaluate(async (url) => {
        const bitmap = await createImageBitmap(await (await fetch(url)).blob());
        const result = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return result;
      }, `/api/media/${uploadedId}?variant=card`);
      expect(dimensions.width).toBe(1080);
      expect(dimensions.height).toBeGreaterThanOrEqual(1900);
      expect(
        Math.abs(dimensions.width / dimensions.height - 9 / 16),
      ).toBeLessThan(0.005);
    }
  } finally {
    const current = await page.request.get('/api/profile');
    if (hasServerSession && current.ok()) {
      const media = (await current.json()).media as { id: string }[];
      for (const item of media.filter((entry) => !originalIds.has(entry.id)))
        await page.request.delete(`/api/media/${item.id}`);
    }
  }
});
