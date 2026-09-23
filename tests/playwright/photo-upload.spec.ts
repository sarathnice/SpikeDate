import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loginSynthetic } from '../qa/ui-helpers';

async function expectUncovered(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  const bounds = await control.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  expect(
    await control.evaluate((element) => {
      const r = element.getBoundingClientRect();
      const front = document.elementFromPoint(
        r.x + r.width / 2,
        r.y + r.height / 2,
      );
      return front === element || element.contains(front);
    }),
    'The control must be at the front, not covered by registration or navigation',
  ).toBe(true);
}

for (const layout of ['compact mobile', 'computer gallery'] as const) {
  test(`photo upload: ${layout} drag, foreground Save, busy status and persisted gallery photo`, async ({
    page,
  }, info) => {
    await page.setViewportSize(
      layout === 'compact mobile'
        ? { width: 360, height: 640 }
        : { width: 1280, height: 800 },
    );
    await loginSynthetic(
      page,
      info.project.name === 'android-mobile' ? 23 : 22,
    );
    const inventory = await page.request.get('/api/profile');
    const before = (await inventory.json()).media as {
      id: string;
      type: string;
    }[];
    const originalIds = new Set(before.map((item) => item.id));
    let uploadedId: string | undefined;
    let releaseUpload!: () => void;
    const uploadGate = new Promise<void>((resolve) => {
      releaseUpload = resolve;
    });
    let uploadAttempts = 0;
    await page.route('**/api/media', async (route) => {
      if (route.request().method() === 'POST') {
        uploadAttempts += 1;
        if (uploadAttempts === 1) {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Upload temporarily unavailable. Please try again.',
            }),
          });
          return;
        }
        await uploadGate;
      }
      await route.continue();
    });
    try {
      await page.getByRole('button', { name: 'Profile', exact: true }).click();
      await page
        .getByRole('button', { name: /Edit preferences & media/i })
        .click();
      const registration = page.getByRole('dialog', {
        name: 'Preferences & media',
      });
      const firstStoredPhoto = before.find((item) => item.type === 'photo');
      if (firstStoredPhoto)
        await expect(
          registration.locator('.profile-media-tile img').first(),
        ).toHaveAttribute('src', new RegExp(firstStoredPhoto.id));
      await registration
        .getByLabel('Add and crop profile photo')
        .setInputFiles(path.resolve('public/maya.png'));
      const editor = page.getByRole('dialog', { name: 'Review your photo' });
      await expect(editor).toBeVisible();
      await expect(
        editor.getByLabel('Photo look', { exact: true }),
      ).toHaveValue('cinematic');
      const exactPreview = editor.locator('canvas.photo-crop-exact-preview');
      await expect(exactPreview).toBeVisible();
      for (const [label, ratio] of [
        ['Discovery 9:16', 9 / 16],
        ['Avatar 1:1', 1],
        ['Profile 4:5', 4 / 5],
      ] as const) {
        await editor.getByRole('button', { name: label, exact: true }).click();
        await expect
          .poll(() =>
            exactPreview.evaluate((el, expectedRatio) => {
              const canvas = el as HTMLCanvasElement;
              return Math.abs(canvas.width / canvas.height - expectedRatio);
            }, ratio),
          )
          .toBeLessThan(0.005);
      }
      const measureLight = () =>
        exactPreview.evaluate((el) => {
          const canvas = el as HTMLCanvasElement;
          const pixels = canvas
            .getContext('2d')!
            .getImageData(0, 0, canvas.width, canvas.height).data;
          let sum = 0;
          for (let index = 0; index < pixels.length; index += 4)
            sum += pixels[index] + pixels[index + 1] + pixels[index + 2];
          return sum / (pixels.length / 4);
        });
      const cinematicLight = await measureLight();
      await editor
        .getByLabel('Photo look', { exact: true })
        .selectOption('bright');
      await expect
        .poll(async () => Math.abs((await measureLight()) - cinematicLight))
        .toBeGreaterThan(0.05);
      const save = editor.getByRole('button', { name: 'Save photo' });
      await expectUncovered(page, save);
      await expectUncovered(
        page,
        editor.getByRole('button', { name: 'Close photo editor' }),
      );
      const stage = editor.locator('.photo-crop-stage');
      // The review strip can scroll the editor below the large crop on a short phone.
      await stage.scrollIntoViewIfNeeded();
      const preview = stage.locator('img');
      await expect
        .poll(() =>
          preview.evaluate((el) => (el as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      const position = await preview.evaluate(
        (el) => (el as HTMLElement).style.objectPosition,
      );
      const bounds = (await stage.boundingBox())!;
      await page.mouse.move(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        bounds.x + bounds.width / 2 + 25,
        bounds.y + bounds.height / 2 + 35,
        { steps: 5 },
      );
      await page.mouse.up();
      expect(
        await preview.evaluate(
          (el) => (el as HTMLElement).style.objectPosition,
        ),
      ).not.toBe(position);
      await editor.getByLabel('Photo zoom').fill('1.18');
      await editor.locator('.photo-crop-body').evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expectUncovered(page, save);
      await info.attach('gallery-crop-save-visible', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
      await save.click();
      await expect(editor.getByRole('alert')).toContainText(
        'Upload temporarily unavailable',
      );
      await expect(save).toBeEnabled();
      await expectUncovered(page, save);
      await expectUncovered(
        page,
        editor.getByRole('button', { name: 'Close photo editor' }),
      );
      const persisted = page.waitForResponse(
        (r) =>
          r.url().endsWith('/api/media') && r.request().method() === 'POST',
      );
      await save.click();
      await expect(editor.locator('.photo-crop-status')).toContainText(
        'Uploading photo',
      );
      await expect(save).toBeDisabled();
      await expectUncovered(page, save);
      await info.attach('upload-progress-foreground', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
      releaseUpload();
      const response = await persisted;
      expect(response.ok()).toBe(true);
      uploadedId = (await response.json()).media.id;
      await expect(editor).toBeHidden({ timeout: 30000 });
      const photo = registration.locator('.profile-media-tile img').last();
      await expect
        .poll(() =>
          photo.evaluate((el) => (el as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      const saved = await page.request.get('/api/profile');
      expect(
        (await saved.json()).media.map((item: { id: string }) => item.id),
      ).toContain(uploadedId);
      for (const variant of ['full', 'card', 'avatar', 'original']) {
        const image = await page.request.get(
          `/api/media/${uploadedId}?variant=${variant}`,
        );
        expect(image.ok(), `Saved ${variant} image must load`).toBe(true);
        expect(image.headers()['content-type']).toMatch(/^image\//);
        if (variant === 'original') {
          expect(
            createHash('sha256')
              .update(await image.body())
              .digest('hex'),
          ).toBe(
            createHash('sha256')
              .update(await readFile(path.resolve('public/maya.png')))
              .digest('hex'),
          );
        } else {
          const size = await page.evaluate(async (url) => {
            const bitmap = await createImageBitmap(
              await (await fetch(url)).blob(),
            );
            const size = { width: bitmap.width, height: bitmap.height };
            bitmap.close();
            return size;
          }, `/api/media/${uploadedId}?variant=${variant}`);
          const ratio =
            variant === 'full' ? 4 / 5 : variant === 'card' ? 9 / 16 : 1;
          expect(Math.abs(size.width / size.height - ratio)).toBeLessThan(
            0.005,
          );
        }
      }
      await page.reload();
      const restored = await page.request.get('/api/profile');
      const restoredMedia = (await restored.json()).media as {
        id: string;
        type: string;
      }[];
      expect(restoredMedia.map((item) => item.id)).toContain(uploadedId);
      const photoOrder = restoredMedia
        .filter((item) => item.type === 'photo')
        .slice(0, 6);
      const uploadedIndex = photoOrder.findIndex(
        (item) => item.id === uploadedId,
      );
      expect(
        uploadedIndex,
        'Uploaded photo must be present in the full-profile photo order',
      ).toBeGreaterThanOrEqual(0);
      await page.getByRole('button', { name: 'Profile', exact: true }).click();
      await page
        .getByRole('button', { name: 'Preview my profile card' })
        .click();
      await expect(
        page.locator('.preview-screen .cinematic-photo-main'),
      ).toHaveAttribute('src', new RegExp(photoOrder[0].id));
      await page
        .getByRole('button', { name: 'Open your full profile preview' })
        .click();
      const full = page.locator('.profile-preview-sheet');
      await expect(full).toBeVisible();
      await expect(
        full.getByRole('button', { name: 'Next profile photo' }),
      ).toBeVisible();
      for (let index = 0; index < uploadedIndex; index++)
        await full.getByRole('button', { name: 'Next profile photo' }).click();
      await expect(full.locator('.film-count')).toContainText(
        `${uploadedIndex + 1} / ${photoOrder.length}`,
      );
      await expect
        .poll(() =>
          full
            .locator('.cinematic-photo-main')
            .evaluate((el) => (el as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      await expect(full.locator('.cinematic-photo-main')).toHaveAttribute(
        'src',
        new RegExp(uploadedId!),
      );
      await full.getByRole('button', { name: 'Close full profile' }).click();
    } finally {
      releaseUpload();
      // Recover any upload id even if a later UI assertion failed. Never delete pre-existing photos.
      const current = await page.request.get('/api/profile');
      if (current.ok()) {
        const media = (await current.json()).media as { id: string }[];
        for (const item of media.filter((item) => !originalIds.has(item.id))) {
          const removed = await page.request.delete(`/api/media/${item.id}`);
          expect(
            removed.ok(),
            'Remove only the synthetic photo uploaded by this isolated test',
          ).toBe(true);
        }
      }
    }
  });
}
