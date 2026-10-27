import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test.skip(({ baseURL }) => baseURL !== 'https://spikedate-stage.sarathnice.workers.dev', 'Imported fictional stage fixtures only.');

for (const number of [101, 600]) {
  test(`stage imported profile ${number}: five photos, unverified, clean card and working gallery`, async ({ page }, info) => {
    test.setTimeout(90_000);
    page.setDefaultTimeout(15_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const credentials = JSON.parse(readFileSync('outputs/qa/profile-import/login.json', 'utf8'));
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByLabel('Email', { exact: true }).fill(`demo${number}@spikedate.test`);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Sign in to SpikeDate', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open Home tools', exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-stage-fictional]')).toHaveCount(1);
    await expect(page.locator('[data-stage-fictional]')).toHaveText('Test environment · fictional profiles');
    await expect(page.locator('[data-local-demo]')).toHaveCount(0);
    const response = await page.request.get('/api/profile');
    expect(response.ok()).toBe(true);
    const own = await response.json();
    expect(own.user.id).toBe(`demo-v2-${number}`);
    expect(own.profile.verification_status).toBe('unverified');
    expect(own.media).toHaveLength(5);
    expect(own.profile.latitude_e6).not.toBeNull();
    expect(own.profile.longitude_e6).not.toBeNull();
    const discoveryResponse = await page.request.get('/api/discover?limit=50');
    expect(discoveryResponse.ok()).toBe(true);
    const discovery = await discoveryResponse.json();
    const imported = discovery.profiles.filter((profile: { id: string }) => profile.id.startsWith('demo-v2-'));
    expect(imported.length).toBeGreaterThan(0);
    for (const profile of imported) {
      expect(profile.media).toHaveLength(5);
      expect(profile.verified).toBe(false);
      expect(profile.active).toBe(false);
    }
    const hashes = new Set<string>();
    for (const item of own.media) {
      // Storage keys are intentionally not exposed by the public profile API.
      expect(item.id).toMatch(new RegExp(`^demo-v2-media-${number}-[0-4]$`));
      const photo = await page.request.get(item.url);
      expect(photo.ok()).toBe(true);
      expect(photo.headers()['content-type']).toMatch(/^image\//);
      const body = await photo.body();
      expect(body.byteLength).toBeGreaterThan(10_000);
      hashes.add(createHash('sha256').update(body).digest('hex'));
    }
    expect(hashes.size).toBe(5);
    const reminder = page.getByRole('button', { name: /^Dismiss Share one fresh moment$/ });
    if (await reminder.isVisible()) await reminder.click();
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Preview my profile card' }).click();
    const preview = page.locator('.preview-screen');
    await expect(preview).toBeVisible();
    await expect(preview).not.toContainText(/local demo|fictional profiles/i);
    await expect(preview.getByRole('img', { name: 'Photo Verified', exact: true })).toHaveCount(0);
    await expect(preview.locator('.cinematic-photo-main')).toHaveCount(1);
    await expect.poll(() => preview.locator('.cinematic-photo-main').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Open your full profile preview' }).click();
    const full = page.locator('.profile-preview-sheet');
    await expect(full.locator('.profile-photo-strip button')).toHaveCount(5);
    await full.getByRole('button', { name: 'View profile photo 5', exact: true }).click();
    await expect(full.locator('.film-count')).toContainText('5 / 5');
    await expect.poll(() => full.locator('.cinematic-photo-main').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await info.attach(`stage-profile-${number}-gallery`, { body: await page.screenshot(), contentType: 'image/png' });
    await page.getByRole('button', { name: 'Close full profile', exact: true }).click();
    expect(errors).toEqual([]);
  });
}
