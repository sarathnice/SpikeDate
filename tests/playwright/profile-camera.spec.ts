import { test, expect } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';
import { installSyntheticCamera, setCameraMode } from '../qa/camera-fixture';

test.skip(
  ({ baseURL }) => !baseURL || !/localhost|127\.0\.0\.1/.test(baseURL),
  'Synthetic photo writes are local only.',
);

test('profile camera: permission, retake, framing, Save and persisted photo', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await installSyntheticCamera(page);
  await loginSynthetic(page, info.project.name === 'android-mobile' ? 23 : 22);
  const before = (await (await page.request.get('/api/profile')).json())
    .media as { id: string }[];
  const originalIds = new Set(before.map((item) => item.id));
  try {
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page
      .getByRole('button', { name: /Edit preferences & media/i })
      .click();
    await page
      .getByRole('button', { name: 'Take a profile photo', exact: true })
      .click();
    const camera = page.locator('.profile-camera-dialog');
    await expect(camera).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __cameraQA: { calls: number } }).__cameraQA
            .calls,
      ),
    ).toBe(0);
    await setCameraMode(page, 'denied');
    await camera
      .getByRole('button', { name: 'Start camera', exact: true })
      .click();
    await expect(camera.getByRole('alert')).toContainText(
      'permission was denied',
    );
    await setCameraMode(page, 'face');
    await camera
      .getByRole('button', { name: 'Start camera', exact: true })
      .click();
    await expect
      .poll(() =>
        camera
          .locator('video')
          .evaluate((el) => (el as HTMLVideoElement).readyState),
      )
      .toBeGreaterThanOrEqual(2);
    await expect(camera.locator('.profile-camera-guidance')).toBeVisible();
    await camera
      .getByRole('button', { name: 'Capture photo', exact: true })
      .click();
    await expect(
      camera.getByRole('img', { name: 'Captured portrait' }),
    ).toBeVisible();
    await camera.getByRole('button', { name: 'Retake', exact: true }).click();
    await expect
      .poll(() =>
        camera
          .locator('video')
          .evaluate((el) => (el as HTMLVideoElement).readyState),
      )
      .toBeGreaterThanOrEqual(2);
    await camera
      .getByRole('button', { name: 'Capture photo', exact: true })
      .click();
    await camera
      .getByRole('button', { name: 'Use photo', exact: true })
      .click();
    await expect(camera).toBeHidden();
    const crop = page.locator('.photo-crop-dialog');
    await expect(crop).toBeVisible();
    await expect(
      crop.locator('.photo-face-assistance [role="status"]'),
    ).toContainText('Face framed automatically', { timeout: 30000 });
    await expect(crop.locator('.photo-preview-variants canvas')).toHaveCount(3);
    const save = crop.getByRole('button', { name: 'Save photo', exact: true });
    await expect(save).toBeInViewport();
    expect(
      await save.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const front = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        return front === el || el.contains(front);
      }),
    ).toBe(true);
    await save.click();
    await expect(crop).toBeHidden({ timeout: 30000 });
    const saved = (await (await page.request.get('/api/profile')).json())
      .media as { id: string }[];
    const added = saved.find((item) => !originalIds.has(item.id));
    expect(added).toBeTruthy();
    for (const variant of ['full', 'card', 'avatar', 'original']) {
      const response = await page.request.get(
        `/api/media/${added!.id}?variant=${variant}`,
      );
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toMatch(/^image\//);
    }
    expect(
      await page.evaluate(() =>
        (
          window as unknown as { __cameraQA: { streams: MediaStream[] } }
        ).__cameraQA.streams
          .flatMap((s) => s.getTracks())
          .every((t) => t.readyState === 'ended'),
      ),
    ).toBe(true);
    await page.screenshot({
      path: `outputs/profile-camera-saved-${info.project.name}.png`,
    });
  } finally {
    const current = (await (await page.request.get('/api/profile')).json())
      .media as { id: string }[];
    for (const item of current)
      if (!originalIds.has(item.id))
        await page.request.delete(`/api/media/${item.id}`);
  }
});

test('profile camera: closing during permission request stops late streams', async ({
  page,
}, info) => {
  await installSyntheticCamera(page);
  await loginSynthetic(page, info.project.name === 'android-mobile' ? 23 : 22);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: /Edit preferences & media/i }).click();
  await page
    .getByRole('button', { name: 'Take a profile photo', exact: true })
    .click();
  await setCameraMode(page, 'delayed');
  const camera = page.locator('.profile-camera-dialog');
  await camera
    .getByRole('button', { name: 'Start camera', exact: true })
    .click();
  await camera
    .getByRole('button', { name: 'Close profile camera', exact: true })
    .click();
  await expect(camera).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const streams = (
          window as unknown as { __cameraQA: { streams: MediaStream[] } }
        ).__cameraQA.streams;
        return (
          streams.length > 0 &&
          streams
            .flatMap((s) => s.getTracks())
            .every((t) => t.readyState === 'ended')
        );
      }),
    )
    .toBe(true);
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
  await page.getByRole('button', { name: /Edit preferences & media/i }).click();
  await page.getByLabel('Add and crop profile photo').setInputFiles({
    name: 'qa-group.png',
    mimeType: 'image/png',
    buffer: Buffer.from(group, 'base64'),
  });
  const crop = page.locator('.photo-crop-dialog');
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
  await page.screenshot({
    path: `outputs/photo-face-selection-${info.project.name}.png`,
  });
  await crop
    .getByRole('button', { name: 'Close photo editor', exact: true })
    .click();
  const blank = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 480;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#aaa';
    ctx.fillRect(0, 0, 480, 480);
    return c.toDataURL('image/png').split(',')[1];
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
