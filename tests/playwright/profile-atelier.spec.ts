import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test('Quiet Atelier A: eight editable icon rows and grouped full details fit every theme', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await loginSynthetic(page, info.project.name === 'ios-mobile' ? 13 : 1);
  const edits = [
    'Edit basics',
    'Edit about you',
    'Edit family & pets',
    'Edit lifestyle',
    'Edit relationship goals',
    'Edit interests',
    'Edit prompts',
    'Edit preferences & media',
  ];
  for (const theme of [
    'default',
    'aurora',
    'velvet',
    'solar',
    'liquid',
    'lime',
    'gallery',
  ]) {
    await page.evaluate(
      (value) => localStorage.setItem('pulse-theme', value),
      theme,
    );
    await page.reload();
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    const categories = page.locator('.atelier-categories');
    await expect(categories.locator('button')).toHaveCount(8);
    for (const width of [320, 430]) {
      await page.setViewportSize({ width, height: 844 });
      const tools = page.locator('.lower-profile-tools');
      await expect(tools).toHaveCSS('flex-direction', 'column');
      for (const row of await tools.locator(':scope > button').all()) {
        await row.scrollIntoViewIfNeeded();
        await expect(row.locator('strong')).toHaveCSS('font-weight', '400');
        const fits = await row.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return (
            box.right <= innerWidth &&
            [...el.children].every(
              (child) => child.getBoundingClientRect().right <= box.right + 1,
            )
          );
        });
        expect(fits).toBe(true);
      }
      for (const row of await categories.locator('button').all()) {
        await row.scrollIntoViewIfNeeded();
        await expect(row.locator('.atelier-category-icon svg')).toBeVisible();
        await expect(row.locator('small')).toHaveCSS('font-size', '12.64px');
        await expect(row.locator('small')).toHaveCSS('font-weight', '400');
        await expect(row.locator('strong')).toHaveCSS('font-size', '12px');
        await expect(row.locator('strong')).toHaveCSS('font-weight', '400');
        const layout = await row.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const children = [...el.children].map((child) =>
            child.getBoundingClientRect(),
          );
          return {
            height: box.height,
            fits:
              children.every(
                (child) =>
                  child.left >= box.left && child.right <= box.right + 1,
              ) && box.right <= innerWidth,
          };
        });
        expect(layout.height).toBeGreaterThanOrEqual(44);
        expect(layout.fits).toBe(true);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
    if (theme === 'default') {
      for (const [index, label] of edits.entries()) {
        await page.getByRole('button', { name: label, exact: true }).click();
        const editor = page.locator('.registration-dialog');
        await expect(editor).toBeVisible();
        await expect(editor.locator('.flow-kicker')).toContainText(
          `${index + 1} OF 8`,
        );
        await editor
          .getByRole('button', { name: 'Close registration' })
          .click();
      }
      await info.attach('quiet-atelier-editable-categories', {
        body: await categories.screenshot(),
        contentType: 'image/png',
      });
    }
    await page.getByRole('button', { name: 'Preview my profile card' }).click();
    await page
      .getByRole('button', { name: 'Open your full profile preview' })
      .click({ position: { x: 35, y: 80 } });
    const full = page.locator('.profile-preview-sheet');
    await expect(full.locator('.atelier-fact-group')).toHaveCount(3);
    await expect(full.locator('.full-passport-facts > div')).toHaveCount(10);
    for (const width of [320, 430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const label of [
        'The essentials',
        'Family & future',
        'Everyday life',
      ]) {
        const group = full.getByRole('region', { name: label, exact: true });
        await group.scrollIntoViewIfNeeded();
        await expect(group.locator('.section-label > svg')).toBeVisible();
        const grid = group.locator('.full-passport-facts');
        expect(
          await grid.evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
          ),
        ).toBe(label === 'Family & future' ? 2 : 4);
        for (const fact of await grid.locator(':scope > div').all()) {
          await expect(fact.locator('svg')).toHaveCSS('opacity', '0.84');
          await expect(fact.locator('small')).toHaveCSS('font-size', '11px');
          await expect(fact.locator('strong')).toHaveCSS('font-size', '12px');
          await expect(fact.locator('strong')).toHaveCSS('font-weight', '400');
          expect(
            await fact.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          ).toBe(true);
        }
      }
    }
    await expect(full.locator('.passport-story p')).toHaveCSS(
      'font-size',
      '12.64px',
    );
    await expect(full.locator('.passport-story p')).toHaveCSS(
      'font-weight',
      '400',
    );
    if (theme === 'default')
      await info.attach('quiet-atelier-full-details', {
        body: await full.locator('.profile-details').screenshot(),
        contentType: 'image/png',
      });
    await full.getByRole('button', { name: 'Close full profile' }).click();
    await page.getByRole('button', { name: 'Back to profile' }).click();
  }
});
