import { expect, test, type Page } from '@playwright/test';

type Person = { id: string; email: string; display_name: string | null; phone_number: string | null };
type Directory = { rows: Person[]; total: number; allTotal: number; page: number; pages: number };
type Overview = { metrics: Record<string, number>; openCases: unknown[]; moderationQueue: unknown[] };

async function signIn(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Email address').fill('test001@spikedate.test');
  await page.getByLabel('Password').fill('SpikeDate2026!');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
}

function nav(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: new RegExp(`^${name}`) });
}

test('overview numbers and operations sections show live database state', async ({ page }) => {
  await signIn(page);
  const response = await page.request.get('/api/admin/overview');
  expect(response.ok()).toBe(true);
  const overview = await response.json() as Overview;
  for (const [label, key] of [['All accounts', 'allUsers'], ['Active accounts', 'activeUsers'], ['Open reports', 'openReports'], ['Media to review', 'pendingMedia']] as const) {
    const tile = page.locator('.admin-metrics article').filter({ hasText: label });
    await expect(tile.locator('strong')).toHaveText(String(overview.metrics[key]));
  }
  await nav(page, 'Reports').click();
  await expect(page.getByRole('heading', { name: 'Oldest open reports' })).toBeVisible();
  await expect(page.locator('.admin-panel .admin-item')).toHaveCount(overview.openCases.length);
  if (overview.openCases.length) {
    await page.locator('.admin-panel .admin-item').first().getByRole('button', { name: 'Review' }).click();
    await expect(page.getByLabel('Decision note · required')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
  }
  await nav(page, 'Media').click();
  await expect(page.getByRole('heading', { name: 'Pending uploads' })).toBeVisible();
  await expect(page.locator('.admin-media-item')).toHaveCount(overview.moderationQueue.length);
  await nav(page, 'Privacy').click();
  await expect(page.getByRole('heading', { name: 'Data requests' })).toBeVisible();
  await nav(page, 'Appeals').click();
  await expect(page.getByRole('heading', { name: 'Moderation appeals' })).toBeVisible();
  await nav(page, 'Activity').click();
  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('People directory paginates every account and supports exact field search and filters', async ({ page }) => {
  await signIn(page);
  await nav(page, 'People').click();
  const directoryResponse = await page.request.get('/api/admin/operations?view=users&page=1');
  expect(directoryResponse.ok()).toBe(true);
  const directory = await directoryResponse.json() as Directory;
  await expect(page.getByText(`${directory.allTotal.toLocaleString()} total accounts`, { exact: false })).toBeVisible();
  await expect(page.getByText(new RegExp(`page 1 of ${directory.pages}`))).toBeVisible();
  const search = page.getByLabel('Find a person or ask a question');
  const first = directory.rows[0];
  expect(first).toBeTruthy();
  if (directory.pages > 1) {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText(new RegExp(`page 2 of ${directory.pages}`))).toBeVisible();
    await page.getByRole('button', { name: 'Previous' }).click();
  }
  for (const term of [first.email, first.id, first.display_name, first.phone_number].filter((value): value is string => Boolean(value))) {
    await search.fill(term);
    await page.getByRole('button', { name: 'Search people' }).click();
    await expect(page.locator('.admin-people-directory .admin-item').filter({ hasText: first.email })).toBeVisible();
  }
  await page.getByRole('combobox', { name: 'Account status' }).selectOption('suspended');
  await expect(page.getByText(/match current filters/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Photo verification' }).selectOption('verified');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByText(`${directory.allTotal.toLocaleString()} total accounts · ${directory.allTotal.toLocaleString()} match current filters`)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('assistant answers supported counts and an account opens its detailed tabs', async ({ page }) => {
  await signIn(page);
  await nav(page, 'People').click();
  const assistant = page.getByLabel('Find a person or ask a question');
  await assistant.fill('How many people?');
  await page.getByRole('button', { name: 'Ask about this' }).click();
  await expect(page.getByText(/total accounts in SpikeDate/)).toBeVisible();
  await assistant.fill('How many active users?');
  await page.getByRole('button', { name: 'Ask about this' }).click();
  await expect(page.getByText(/active accounts in SpikeDate/)).toBeVisible();
  await assistant.fill('How many verified people in Boston?');
  await page.getByRole('button', { name: 'Ask about this' }).click();
  await expect(page.getByText(/People directory filters/)).toBeVisible();
  await page.locator('.admin-people-directory .admin-item').first().getByRole('button', { name: 'Open account' }).click();
  await expect(page.getByText('Account record', { exact: true })).toBeVisible();
  for (const name of ['Photos & verification', 'Connections', 'Safety', 'Billing']) {
    await page.getByRole('navigation', { name: 'Account details' }).getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.getByRole('button', { name: '← People' }).click();
  await expect(page.getByRole('heading', { name: 'All people' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('asking for Maya shows a visible account result or a useful error', async ({ page }) => {
  await signIn(page);
  await nav(page, 'People').click();
  await page.getByLabel('Find a person or ask a question').fill('maya');
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/admin/assistant'));
  await page.getByRole('button', { name: 'Ask about this' }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(page.locator('.admin-directory-answer')).toBeVisible();
  await expect(page.locator('.admin-directory-answer')).toBeInViewport();
  await expect(page.locator('.admin-directory-answer').getByRole('button', { name: /Maya/i })).toBeVisible();
});

test('report and media review controls require a note before a decision', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/admin/overview', async (route) => {
    const response = await route.fetch();
    const overview = await response.json() as Overview;
    overview.metrics.openReports = 1;
    overview.metrics.pendingMedia = 1;
    overview.openCases = [{ id: 'qa-preview-report', reason: 'Test report', details: 'Synthetic UI fixture', created_at: Date.now(), reporter_name: 'QA Reporter', subject_name: 'QA Subject' }];
    overview.moderationQueue = [{ id: 'qa-preview-media', type: 'photo', created_at: Date.now(), display_name: 'QA Subject' }];
    await route.fulfill({ response, json: overview });
  });
  await page.getByRole('button', { name: 'Refresh' }).click();
  await nav(page, 'Reports').click();
  await page.locator('.admin-panel .admin-item').first().getByRole('button', { name: 'Review' }).click();
  await expect(page.getByRole('button', { name: 'Dismiss', exact: true })).toBeDisabled();
  await page.getByLabel('Decision note · required').fill('Checked the synthetic report evidence.');
  await expect(page.getByRole('button', { name: 'Dismiss', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await nav(page, 'Media').click();
  await page.locator('.admin-media-item').getByRole('button', { name: 'Review' }).click();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await page.getByLabel('Decision note · required').fill('Checked the synthetic media fixture.');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
