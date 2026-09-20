import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test('Galaxy tabs: mobile layout, category icons, keyboard access and working destinations', async ({
  page,
}, info) => {
  await loginSynthetic(page, 42);
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  const hub = page.locator('.explore-hub');
  await expect(
    hub.getByRole('heading', { name: 'Galaxy', exact: true }),
  ).toBeVisible();
  await expect(hub.getByRole('tab')).toHaveCount(3);
  await expect(hub.locator('.room-tile')).toHaveCount(8);
  await expect(hub.locator('.room-copy strong svg')).toHaveCount(8);
  for (const tile of await hub.locator('.room-tile').all()) {
    await expect(tile).toHaveCSS('height', '98px');
    await expect(tile).toHaveCSS('grid-column-start', 'auto');
  }
  await expect(hub.locator('.explore-tabs button svg')).toHaveCount(3);
  await expect(hub.locator('#explore-panel-plans')).not.toBeVisible();
  await expect(hub.locator('#explore-panel-connect')).not.toBeVisible();
  for (const width of [320, 390, 412]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await hub.evaluate(
        (element) => element.scrollHeight / element.clientHeight,
      ),
    ).toBeLessThan(2);
    for (const button of await hub
      .locator('.room-tile, .explore-tabs button')
      .all()) {
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'outputs/qa/explore-tabs-browse.png' });
  await hub.getByRole('tab', { name: 'Browse', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    hub.getByRole('tab', { name: 'Plans', exact: true }),
  ).toBeFocused();
  await expect(hub.locator('#explore-panel-plans')).toBeVisible();
  await expect(hub.locator('#explore-panel-browse')).not.toBeVisible();
  await page.getByRole('button', { name: /Plan a coffee date/ }).click();
  await expect(page.locator('.plan-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await hub.getByRole('tab', { name: 'Connect', exact: true }).click();
  await page.screenshot({ path: 'outputs/qa/explore-tabs-connect.png' });
  await hub.getByRole('button', { name: /Star Connection/ }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'not a scientifically validated measure',
  );
  await page.keyboard.press('Escape');
  await hub.getByRole('button', { name: /Play Together/ }).click();
  await expect(page.locator('.chat-list')).toBeVisible();
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  await hub.getByRole('button', { name: /Outdoors/ }).click();
  await expect(
    page.getByRole('button', { name: 'Back to Galaxy' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to Galaxy' }).click();
  await expect(hub).toBeVisible();
  await info.attach('Galaxy preview', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});
