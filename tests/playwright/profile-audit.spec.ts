import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

const count = Number(process.env.SPIKEDATE_QA_PROFILES ?? 3);
if (!Number.isInteger(count) || count < 1 || count > 60)
  throw new Error('SPIKEDATE_QA_PROFILES must be 1..60');
for (let number = 1; number <= count; number++) {
  test(`profile audit: account ${String(number).padStart(3, '0')} photos and mobile preview`, async ({
    page,
  }, info) => {
    await loginSynthetic(page, number);
    const response = await page.request.get('/api/profile');
    expect(response.ok(), 'Live profile API must return successfully').toBe(
      true,
    );
    const data = (await response.json()) as {
      media: { id: string; type: string; url: string }[];
      profile: { display_name: string };
      connection: {
        relationshipStyle: string;
        datingPace: string;
        communicationPreference: string;
        values: string[];
        rhythm: string[];
        languages: string[];
      };
    };
    const photos = data.media.filter((item) => item.type === 'photo');
    await info.attach('photo-inventory', {
      body: JSON.stringify(
        { account: number, name: data.profile.display_name, photos },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    expect
      .soft(
        photos.length,
        'Profile has no stored photos; do not silently pass a placeholder',
      )
      .toBeGreaterThan(0);
    for (const photo of photos) {
      const media = await page.request.get(photo.url, { timeout: 20000 });
      expect
        .soft(
          media.ok(),
          `Photo ${photo.id} download failed: HTTP ${media.status()}`,
        )
        .toBe(true);
      expect
        .soft(
          media.headers()['content-type'],
          `Photo ${photo.id} must return image data`,
        )
        .toMatch(/^image\//);
    }
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Preview my profile card' }).click();
    const preview = page.locator('.preview-screen');
    await expect(preview).toBeVisible();
    const image = preview.locator('.cinematic-photo-main');
    await expect(image).toBeVisible();
    if (photos[0])
      await expect(image).toHaveAttribute('src', new RegExp(photos[0].id));
    await expect
      .poll(
        () =>
          image.evaluate(
            (element) => (element as HTMLImageElement).naturalWidth,
          ),
        { timeout: 20000 },
      )
      .toBeGreaterThan(0);
    await expect(image).toHaveCSS('object-fit', 'cover');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      'No horizontal page overflow',
    ).toBe(true);
    await info.attach('profile-preview', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    const openFull = preview.getByRole('button', {
      name: 'Open your full profile preview',
    });
    await openFull.focus();
    await page.keyboard.press('Enter');
    const full = page.locator('.profile-preview-sheet');
    await expect(full).toBeVisible();
    await expect(full.locator('.profile-title h2')).toContainText(
      data.profile.display_name,
    );
    await expect(full.locator('.passport-story')).toBeVisible();
    const connectionText = [
      data.connection.relationshipStyle,
      data.connection.datingPace,
      data.connection.communicationPreference,
      ...data.connection.values,
      ...data.connection.rhythm,
      ...data.connection.languages,
    ].filter(Boolean);
    const summary = full.getByRole('region', { name: 'Connection details' });
    if (connectionText.length) {
      await expect(summary).toBeVisible();
      for (const text of connectionText)
        await expect(summary).toContainText(text);
    } else {
      await expect(summary).toHaveCount(0);
    }
    for (let photoIndex = 1; photoIndex < photos.length; photoIndex++) {
      await full.getByRole('button', { name: 'Next profile photo' }).click();
      await expect(full.locator('.cinematic-photo-main')).toHaveAttribute(
        'src',
        new RegExp(photos[photoIndex].id),
      );
    }
    await expect
      .poll(() =>
        full
          .locator('.cinematic-photo-main')
          .evaluate((el) => (el as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(full.locator('.sheet-actions')).toHaveCount(0);
    await expect(
      full.getByRole('button', { name: /Report|Block|Send a Spike|Like/ }),
    ).toHaveCount(0);
    await info.attach('full-profile-preview', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await full.getByRole('button', { name: 'Close full profile' }).click();
    await expect(full).toBeHidden();
    await expect(preview).toBeVisible();
    await openFull.click({ position: { x: 40, y: 80 } });
    await expect(full).toBeVisible();
    await full.getByRole('button', { name: 'Close full profile' }).click();
    await preview.getByRole('button', { name: 'Back to profile' }).click();
    await expect(page.locator('.profile-page')).toBeVisible();
  });
}
