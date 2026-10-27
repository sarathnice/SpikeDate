import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.skip(({ baseURL }) => baseURL !== 'http://127.0.0.1:3016', 'Isolated local admin-banner QA fixtures only.');
const password = () => (JSON.parse(readFileSync('outputs/qa/admin-banner/credentials.json', 'utf8')) as { password: string }).password;
type Snapshot = { label: string; text: string; version: number; affectedProfiles: number };

test('super admin reviews one environment-wide update, persists it, and can restore it', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address').fill('super@banner.spikedate.test');
  await page.getByLabel('Password', { exact: true }).fill(password());
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Environment', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Environment banner settings' });
  await expect(panel.getByLabel('Banner label', { exact: true })).toBeVisible();
  const original = await (await page.request.get('/api/admin/environment/banner')).json() as Snapshot;
  const label = original.label === 'Staging' ? 'Local preview' : 'Staging';
  try {
    await panel.getByLabel('Banner label', { exact: true }).selectOption(label);
    await expect(panel.getByRole('button', { name: 'Review banner update' })).toBeDisabled();
    await panel.getByLabel('Change reason · required').fill('Standardize the isolated QA environment banner.');
    await panel.getByRole('button', { name: 'Review banner update' }).click();
    await expect(panel.getByRole('region', { name: 'Confirm environment-wide banner change' })).toContainText('Confirm all 3 profiles');
    await panel.getByRole('button', { name: 'Apply label for all profiles', exact: true }).click();
    await expect(panel.getByRole('status')).toContainText('Banner updated for all 3 profiles');
    await expect(page.locator('[data-environment-banner]')).toHaveText(`${label} · fictional profiles`);
    const next = await (await page.request.get('/api/admin/environment/banner')).json() as Snapshot;
    expect(next.version).toBe(original.version + 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-environment-banner]')).toHaveText(`${label} · fictional profiles`);
    await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Environment', exact: true }).click();
    await expect(panel.getByLabel('Banner label', { exact: true })).toHaveValue(label);
    await info.attach('environment-banner-admin', { body: await page.screenshot(), contentType: 'image/png' });
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(panel.getByRole('heading', { name: 'Banner label · apply to all profiles' })).toBeVisible();
      expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Activity', exact: true }).click();
    await expect(page.locator('.admin-audit-item').filter({ hasText: 'admin.environment.banner.update' }).first()).toBeVisible();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-environment-banner]')).toHaveCount(1);
    await expect(page.locator('[data-environment-banner]')).toHaveText(`${label} · fictional profiles`);
    expect(errors).toEqual([]);
  } finally {
    const current = await (await page.request.get('/api/admin/environment/banner')).json() as Snapshot;
    if (current.label !== original.label) {
      const response = await page.request.patch('/api/admin/environment/banner', { data: { label: original.label, expectedVersion: current.version, reason: 'Restore the original QA banner after testing.' } });
      expect(response.ok()).toBe(true);
    }
  }
});

test('real API enforces staff role, origin, allowlist, reason and concurrent version guards', async ({ playwright, baseURL }) => {
  // Reuse the connection to cover a denied PATCH followed by another login.
  const client = await playwright.request.newContext({ baseURL });
  expect((await client.get('/api/admin/environment/banner')).status()).toBe(401);
  for (const role of ['support', 'member']) {
    expect((await client.post('/api/auth/login', { data: { email: `${role}@banner.spikedate.test`, password: password() } })).ok()).toBe(true);
    expect((await client.get('/api/admin/environment/banner')).status()).toBe(403);
    expect((await client.patch('/api/admin/environment/banner', { data: { label: 'Staging', expectedVersion: 0, reason: 'Unauthorized label update should be blocked.' } })).status()).toBe(403);
  }
  const admin = client;
  await admin.post('/api/admin/login', { data: { email: 'super@banner.spikedate.test', password: password() } });
  const original = await (await admin.get('/api/admin/environment/banner')).json() as Snapshot;
  const data = { label: original.label === 'Staging' ? 'Local preview' : 'Staging', expectedVersion: original.version, reason: 'Check permission and concurrency safety locally.' };
  try {
    expect((await admin.patch('/api/admin/environment/banner', { headers: { origin: 'https://untrusted.example' }, data })).status()).toBe(403);
    for (const invalid of [{ label: 'Real members' }, { enabled: false }, { reason: 'short' }]) expect((await admin.patch('/api/admin/environment/banner', { data: { ...data, ...invalid } })).status()).toBe(400);
    const results = await Promise.all(['Local demo', 'Local preview'].map(label => admin.patch('/api/admin/environment/banner', { data: { ...data, label: label === original.label ? 'Test environment' : label } })));
    expect(results.map(response => response.status()).sort()).toEqual([200, 409]);
    expect((await admin.patch('/api/admin/environment/banner', { data })).status()).toBe(409);
  } finally {
    const current = await (await admin.get('/api/admin/environment/banner')).json() as Snapshot;
    if (current.label !== original.label) expect((await admin.patch('/api/admin/environment/banner', { data: { label: original.label, expectedVersion: current.version, reason: 'Restore QA environment after concurrency checks.' } })).ok()).toBe(true);
    await admin.dispose();
  }
});
