import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.skip(({ baseURL }) => baseURL !== 'http://127.0.0.1:3007', 'Local fictional fixtures only.');

test('mobile Anywhere, any adult age and 100 miles save and survive reload', async ({ page }, info) => {
  const credentials = JSON.parse(readFileSync('outputs/qa/profile-import/login.json', 'utf8'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in to SpikeDate', exact: true }).click();
  const tools = page.getByRole('button', { name: 'Open Home tools', exact: true });
  await expect(tools).toBeVisible({ timeout: 30_000 });
  const original = await (await page.request.get('/api/profile')).json();
  const location = (await (await page.request.get('/api/discovery-location')).json()).location;
  const old = original.preferences;
  async function openFilters() {
    for (const name of [/^Dismiss /i, /^Later$/, /^Maybe later$/]) {
      const button = page.getByRole('button', { name }).first();
      if (await button.isVisible()) await button.click();
    }
    await tools.click();
    await page.getByRole('dialog', { name: 'Tools', exact: true }).getByRole('button', { name: /^Filters/ }).click();
    return page.getByRole('dialog', { name: 'Preferences', exact: true });
  }
  try {
    const baseline = await page.request.put('/api/discovery-location', { data: { mode: 'city', city: 'Boston' } });
    expect(baseline.ok()).toBe(true);
    await page.reload();
    await expect(tools).toBeVisible();
    let filters = await openFilters();
    await filters.getByRole('button', { name: 'Any adult age (18+)', exact: true }).click();
    await filters.getByRole('checkbox', { name: 'Anywhere · all locations' }).check();
    await expect(filters.getByLabel('Filter maximum distance')).toBeDisabled();
    await filters.getByRole('button', { name: 'Apply preferences', exact: true }).click();
    await expect(filters).toBeHidden();
    expect((await (await page.request.get('/api/discovery-location')).json()).location.mode).toBe('anywhere');
    const account = await (await page.request.get('/api/profile')).json();
    expect(account.preferences.min_age).toBe(18);
    expect(account.preferences.max_age).toBe(99);
    const discoveryResponse = await page.request.get('/api/discover?limit=50');
    expect(discoveryResponse.ok()).toBe(true);
    const discovery = await discoveryResponse.json();
    expect(new Set(discovery.profiles.map((p: { city: string }) => p.city)).size).toBeGreaterThan(1);
    expect(discovery.profiles.every((p: { age: number }) => p.age >= 18)).toBe(true);
    await page.reload();
    await expect(tools).toBeVisible();
    filters = await openFilters();
    await expect(filters.getByRole('checkbox', { name: 'Anywhere · all locations' })).toBeChecked();
    await expect(filters.getByRole('button', { name: 'Any adult age (18+)', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await info.attach('anywhere-mobile-filters', { body: await page.screenshot(), contentType: 'image/png' });
    await filters.getByRole('checkbox', { name: 'Anywhere · all locations' }).uncheck();
    const distance = filters.getByLabel('Filter maximum distance');
    await expect(distance).toHaveAttribute('max', '100');
    await distance.fill('100');
    await expect(filters).toContainText('100 miles');
    await filters.getByRole('button', { name: 'Apply preferences', exact: true }).click();
    await expect(filters).toBeHidden();
    expect((await (await page.request.get('/api/profile')).json()).preferences.max_distance_km).toBe(161);
    await page.reload();
    await expect(tools).toBeVisible();
    filters = await openFilters();
    await expect(filters.getByLabel('Filter maximum distance')).toHaveValue('100');
    await expect(filters.getByRole('checkbox')).not.toBeChecked();
    expect(await filters.evaluate(el => el.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    if (old) await page.request.patch('/api/profile', { data: { section: 'preferences', data: {
      genders: JSON.parse(old.genders_json), minAge: old.min_age, maxAge: old.max_age,
      maxDistanceKm: old.max_distance_km, relationshipGoals: JSON.parse(old.relationship_goals_json),
      dealbreakers: JSON.parse(old.dealbreakers_json || '[]'),
    } } });
    if (location.mode === 'city') await page.request.put('/api/discovery-location', { data: { mode: 'city', city: location.city } });
    else if (location.mode === 'unset') await page.request.delete('/api/discovery-location');
    else if (location.mode === 'device') await page.request.put('/api/discovery-location', { data: { mode: 'device', latitude: original.profile.latitude_e6 / 1e6, longitude: original.profile.longitude_e6 / 1e6 } });
    else await page.request.put('/api/discovery-location', { data: { mode: location.mode } });
  }
});
