import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test.skip(
  ({ baseURL }) =>
    !baseURL ||
    !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname) ||
    new URL(baseURL).port !== '3007',
  'Local synthetic profile fixtures only.',
);

for (const number of [13, 1]) {
  test(`Own preview ${number}: saved text, Quiet Rail controls, live presence and full preview`, async ({
    page,
  }, info) => {
    await loginSynthetic(page, number);
    const original = await (await page.request.get('/api/profile')).json();
    const preference = await (await page.request.get('/api/presence')).json();
    const answer = `A quiet café, an easy conversation and a sunset walk · ${info.project.name}`;
    try {
      expect(
        (
          await page.request.patch('/api/profile', {
            data: {
              section: 'prompts',
              data: [{ prompt: 'My ideal first date', answer }],
            },
          })
        ).ok(),
      ).toBe(true);
      expect(
        (
          await page.request.patch('/api/presence', {
            data: { showOnline: true },
          })
        ).ok(),
      ).toBe(true);
      await page.reload();
      await page.getByRole('button', { name: 'Profile', exact: true }).click();
      await page
        .getByRole('button', { name: 'Preview my profile card' })
        .click();
      const preview = page.locator('.preview-screen');
      await expect(preview.locator('.card-story')).toHaveText(answer);
      await expect(preview.locator('.profile-presence')).toHaveText(
        'Online now',
        { timeout: 30000 },
      );
      let sends = 0;
      page.on('request', (request) => {
        if (
          request.method() === 'POST' &&
          /\/api\/(interactions|conversations|billing)/.test(request.url())
        )
          sends++;
      });
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        await expect(
          preview.locator('.distance .lucide-map-pin'),
        ).toBeVisible();
        await expect(
          preview.locator('.chips span:first-child .lucide-heart'),
        ).toBeVisible();
        await expect(preview.locator('.profile-presence > span')).toBeVisible();
        const buttons = preview.locator('.home-action-rail button');
        await expect(buttons).toHaveCount(4);
        let previousBottom = 0;
        for (const button of await buttons.all()) {
          await expect(button).toBeVisible();
          const box = await button.boundingBox();
          expect(box!.x).toBeGreaterThan(width / 2);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
          expect(box!.y).toBeGreaterThanOrEqual(previousBottom);
          expect(box!.y + box!.height).toBeLessThanOrEqual(844);
          previousBottom = box!.y + box!.height;
          await button.click();
          await expect(
            preview.locator('.preview-action-feedback'),
          ).toContainText('Preview only');
        }
        const tools = preview.locator('.home-today-tools button');
        await expect(tools).toHaveCount(2);
        for (const tool of await tools.all()) {
          await expect(tool).toBeVisible();
          await tool.click();
          await expect(
            preview.locator('.preview-action-feedback'),
          ).toContainText('Preview only');
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
      }
      expect(sends).toBe(0);
      await page.screenshot({
        path: `outputs/profile-preview-${number}-${info.project.name}.png`,
      });
      await preview
        .getByRole('button', { name: 'Open your full profile preview' })
        .click({ position: { x: 35, y: 80 } });
      const full = page.locator('.profile-preview-sheet');
      await expect(full).toBeVisible();
      await expect(full.locator('.profile-presence')).toHaveText('Online now');
      await expect(full.locator('.passport-story')).toContainText(
        original.profile.bio,
      );
      await expect(
        full.locator('section').filter({
          has: page.locator('.section-label', {
            hasText: 'My ideal first date',
          }),
        }),
      ).toContainText(answer);
      await expect(full.locator('.sheet-actions')).toHaveCount(0);
      await full.getByRole('button', { name: 'Close full profile' }).click();
      // Privacy off must remove the status; do not fake Online in a preview.
      await page.request.patch('/api/presence', {
        data: { showOnline: false },
      });
      await expect(preview.locator('.profile-presence')).toHaveCount(0, {
        timeout: 30000,
      });
      // Empty saved prompts fall back to the real bio, never a template.
      await page.request.patch('/api/profile', {
        data: { section: 'prompts', data: [] },
      });
      await page.reload();
      await page.getByRole('button', { name: 'Profile', exact: true }).click();
      await page
        .getByRole('button', { name: 'Preview my profile card' })
        .click();
      await expect(preview.locator('.card-story')).toHaveText(
        original.profile.bio ?? '',
      );
    } finally {
      await page.request.patch('/api/profile', {
        data: {
          section: 'prompts',
          data: original.prompts.map(
            (prompt: { prompt: string; answer: string }) => ({
              prompt: prompt.prompt,
              answer: prompt.answer,
            }),
          ),
        },
      });
      await page.request.patch('/api/presence', {
        data: { showOnline: preference.showOnline },
      });
    }
  });
}

test('Preview theme geometry: Midnight and Vermilion retain the right-side rail', async ({
  page,
}, info) => {
  await loginSynthetic(page, 13);
  for (const theme of ['default', 'vermilion']) {
    await page.evaluate(
      (value) => localStorage.setItem('pulse-theme', value),
      theme,
    );
    await page.reload();
    await page.setViewportSize({ width: 320, height: 844 });
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Preview my profile card' }).click();
    await expect(page.locator('.app-shell')).toHaveAttribute(
      'data-theme',
      theme,
    );
    const rail = page.locator('.preview-screen .home-action-rail');
    await expect(rail).toHaveCSS('flex-direction', 'column');
    await expect(rail.locator('button')).toHaveCount(4);
    const photo = page.locator('.preview-screen .cinematic-photo-main');
    await expect(photo).toBeVisible();
    await expect
      .poll(
        () => photo.evaluate((el) => (el as HTMLImageElement).naturalWidth),
        { timeout: 20000 },
      )
      .toBeGreaterThan(0);
    let previousBottom = 0;
    for (const button of await rail.locator('button').all()) {
      const box = await button.boundingBox();
      expect(box!.x).toBeGreaterThan(160);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
      expect(box!.y).toBeGreaterThanOrEqual(previousBottom);
      previousBottom = box!.y + box!.height;
      expect(previousBottom).toBeLessThan(844);
    }
    await expect(page.locator('.preview-action-feedback')).toHaveCount(0, {
      timeout: 5000,
    });
    await page.screenshot({
      path: `outputs/profile-preview-${theme}-${info.project.name}.png`,
    });
  }
});
