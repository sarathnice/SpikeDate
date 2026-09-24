import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

async function clearTestLocation(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const response = await fetch('/api/discovery-location', { method: 'DELETE' });
    if (!response.ok) throw new Error(`Could not reset test location: ${response.status}`);
  });
  await page.reload();
}

test.skip(
  ({ baseURL }) => !['3012', '3007'].includes(new URL(baseURL!).port),
  'Run against an isolated local seeded Worker.',
);

test('Galaxy inline first-open choice saves a city without changing the home city', async ({ page }) => {
  await loginSynthetic(page, 1);
  await clearTestLocation(page);
  await expect(page.locator('.profile-card')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Discovery area' })).toBeVisible();
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  const card = page.getByRole('region', { name: 'Discovery area' });
  await expect(card).toContainText('Good connections start nearby.');
  await expect(page.locator('.room-tile')).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await card.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(320);
  await card.getByRole('button', { name: 'Choose a city instead' }).click();
  await card.getByLabel('City to explore').fill('Boston');
  await card.getByRole('button', { name: 'Show people' }).click();
  await expect(card).toContainText('Near Boston');
  await expect(page.locator('.room-tile')).toHaveCount(8);
  const account = await page.evaluate(async () =>
    (await fetch('/api/profile')).json() as Promise<{ profile: { city: string } }>,
  );
  expect(account.profile.city).toBe('Boston');
  await page.reload();
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Discovery area' })).toContainText('Near Boston');
});

test('allowed location is saved coarsely and refreshed on a later app open', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 42.357891, longitude: -71.063912 });
  await loginSynthetic(page, 2);
  await page.evaluate(async () => {
    const response = await fetch('/api/discovery-location', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'city', city: 'Boston' }),
    });
    if (!response.ok) throw new Error(`Could not set test city: ${response.status}`);
  });
  await page.reload();
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  const card = page.getByRole('region', { name: 'Discovery area' });
  await expect(card).toContainText('Near Boston');
  await card.getByRole('button', { name: 'Change discovery area' }).click();
  await card.getByRole('button', { name: 'Use current location' }).click();
  await expect(card).toContainText('Near your current area');
  await expect(page.locator('.room-tile')).toHaveCount(8);
  const first = await page.evaluate(async () =>
    (await fetch('/api/discovery-location')).json() as Promise<{ location: { mode: string; updatedAt: number } }>,
  );
  expect(first.location.mode).toBe('device');
  await page.reload();
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  await expect(card).toContainText('Near your current area');
  const second = await page.evaluate(async () =>
    (await fetch('/api/discovery-location')).json() as Promise<{ location: { mode: string; updatedAt: number } }>,
  );
  expect(second.location.mode).toBe('device');
  expect(second.location.updatedAt).toBeGreaterThanOrEqual(first.location.updatedAt);
});

test('declining location leaves Galaxy in a clear city-choice state', async ({ page }) => {
  await loginSynthetic(page, 3);
  await clearTestLocation(page);
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  const card = page.getByRole('region', { name: 'Discovery area' });
  await card.getByRole('button', { name: 'Not now' }).click();
  await expect(card).toContainText('Choose where to explore');
  await expect(page.locator('.room-tile')).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Choose a city instead' })).toBeVisible();
  const result = await page.evaluate(async () =>
    (await fetch('/api/discovery-location')).json() as Promise<{ location: { mode: string } }>,
  );
  expect(result.location.mode).toBe('denied');
  await page.getByRole('button', { name: 'Spike', exact: true }).click();
  await expect(page.locator('.profile-card')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Discovery area' })).toContainText('Choose where to explore');
});
