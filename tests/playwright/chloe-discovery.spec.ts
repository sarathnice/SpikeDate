import { expect, test } from '@playwright/test';

test('Chloe sees accurate discovery and filter states', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
  await page.reload();
  await page.getByLabel('Test profile').selectOption('test011@spikedate.test');
  await page.getByRole('button', { name: /Fill selected test login/i }).click();
  await page.getByRole('button', { name: 'Sign in to SpikeDate' }).click();
  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible();
  await expect(page.locator('.phone-frame')).toBeVisible();
  const server = await page.request.get('/api/discover?limit=50');
  expect(server.ok()).toBe(true);
  const data = (await server.json()) as { count: number };
  if (data.count > 0) await expect(page.locator('.discover-screen')).toBeVisible();
  else {
    await expect(page.locator('.empty-discover')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adjust preferences' })).toBeVisible();
  }
  await page
    .getByRole('button', { name: /Filter/i })
    .first()
    .click();
  await expect(page.locator('.filter-dialog')).toBeVisible();
  await expect(page.locator('.apply-filters')).not.toHaveText(
    'Show 5 profiles',
  );
  await expect(page.locator('.apply-filters')).toContainText(
    /Show \d+ profiles/,
  );
});

test('Chloe can recover from filters that empty Home', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
  await page.reload();
  await page.getByLabel('Test profile').selectOption('test011@spikedate.test');
  await page.getByRole('button', { name: /Fill selected test login/i }).click();
  await page.getByRole('button', { name: 'Sign in to SpikeDate' }).click();
  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible();
  const server = await page.request.get('/api/discover?limit=50');
  expect(server.ok()).toBe(true);
  const data = (await server.json()) as { count: number };
  test.skip(data.count === 0, 'Chloe has no unseen profiles in this persistent staging fixture.');
  await expect(page.locator('.discover-screen')).toBeVisible();
  await page
    .getByRole('button', { name: /Filter/i })
    .first()
    .click();
  await page.getByLabel('Filter minimum age').fill('60');
  await page.getByLabel('Filter maximum age').fill('60');
  await page.locator('.apply-filters').click();
  await expect(page.locator('.empty-discover')).toBeVisible();
  await expect(page.locator('.empty-discover')).toContainText(
    /profiles are available before your Home filters/,
  );
  await page
    .getByRole('button', { name: 'Show all available profiles' })
    .click();
  await expect(page.locator('.discover-screen')).toBeVisible();
});
