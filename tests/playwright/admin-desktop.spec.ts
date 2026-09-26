import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Email address').fill('test001@spikedate.test');
  await page.getByLabel('Password').fill('SpikeDate2026!');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
}

function section(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: new RegExp(`^${name}(?:\\s|$)`) });
}

test('staff can scroll a long People page, use pagination, and retain navigation', async ({ page }) => {
  await signIn(page);
  await section(page, 'People').click();
  await expect(page.locator('.admin-people-directory .admin-item')).toHaveCount(25);
  expect(await page.evaluate(() => document.body.scrollHeight > innerHeight * 2)).toBe(true);
  await page.mouse.move(1100, 700);
  await page.mouse.wheel(0, 6000);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  await expect(page.locator('.admin-directory-pagination')).toBeInViewport();
  await expect(section(page, 'People')).toBeInViewport();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText(/page 2 of/)).toBeVisible();
  await section(page, 'Overview').click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('staff can search Maya, ask a question, open her record, and inspect every detail tab', async ({ page }) => {
  await signIn(page);
  await section(page, 'People').click();
  const query = page.getByLabel('Find a person or ask a question');
  await query.fill('maya');
  await page.getByRole('button', { name: 'Search people' }).click();
  await expect(page.locator('.admin-people-directory .admin-item').filter({ hasText: /Maya/i })).toBeVisible();
  await page.getByRole('button', { name: 'Ask about this' }).click();
  await expect(page.locator('.admin-directory-answer')).toBeVisible();
  await expect(page.locator('.admin-directory-answer').getByRole('button', { name: /Maya/i })).toBeVisible();
  await page.locator('.admin-directory-answer').getByRole('button', { name: /Maya/i }).click();
  await expect(page.getByText('Account record', { exact: true })).toBeVisible();
  const tabs = page.getByRole('navigation', { name: 'Account details' });
  for (const name of ['Photos & verification', 'Connections', 'Safety', 'Billing', 'Overview']) {
    await tabs.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).click();
    await expect(tabs.getByRole('button', { name: new RegExp(`^${name}$`, 'i') })).toHaveClass(/active/);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.getByRole('button', { name: '← People' }).click();
  await expect(page.getByRole('heading', { name: 'All people' })).toBeVisible();
});

test('staff can navigate every admin section, refresh, and sign out', async ({ page }) => {
  await signIn(page);
  for (const [name, heading] of [
    ['Reports', 'Oldest open reports'], ['Media', 'Pending uploads'],
    ['Privacy', 'Data requests'], ['Appeals', 'Moderation appeals'],
    ['Activity', 'Recent activity'], ['People', 'All people'],
  ]) {
    await section(page, name).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
});

test('staff can retry an account when its first network request fails', async ({ page }) => {
  await signIn(page);
  await section(page, 'People').click();
  await page.getByLabel('Find a person or ask a question').fill('test002@spikedate.test');
  await page.getByRole('button', { name: 'Search people' }).click();
  let attempts = 0;
  await page.route('**/api/admin/users/test-002/details', (route) => {
    attempts += 1;
    return attempts === 1 ? route.abort('failed') : route.continue();
  });
  await page.locator('.admin-people-directory .admin-item').filter({ hasText: 'test002@spikedate.test' }).getByRole('button', { name: 'Open account' }).click();
  await expect(page.getByRole('button', { name: 'Retry loading account' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry loading account' }).click();
  await expect(page.getByText('Account record', { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});

test('each report and media decision sends the selected outcome and review note', async ({ page }) => {
  await signIn(page);
  type Case = { id: string; reason: string; details: string; created_at: number; reporter_name: string; subject_name: string };
  type Media = { id: string; type: 'photo'; created_at: number; display_name: string };
  const cases: Case[] = ['dismissed', 'warned', 'suspended'].map((outcome, index) => ({
    id: `qa-report-${outcome}`, reason: 'Synthetic QA', details: `QA ${outcome}`,
    created_at: Date.now() + index, reporter_name: 'QA Reporter', subject_name: `QA ${outcome}`,
  }));
  const media: Media[] = ['approved', 'rejected'].map((outcome, index) => ({
    id: `qa-media-${outcome}`, type: 'photo', created_at: Date.now() + index,
    display_name: `QA ${outcome}`,
  }));
  const decisions: Array<{ id: string; outcome: string; note: string }> = [];
  await page.route('**/api/admin/overview', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.openCases = [...cases]; body.moderationQueue = [...media];
    body.metrics.openReports = cases.length; body.metrics.pendingMedia = media.length;
    await route.fulfill({ response, json: body });
  });
  await page.route('**/api/admin/cases/qa-report-*', async (route) => {
    const body = route.request().postDataJSON() as { outcome: string; note: string };
    const id = route.request().url().split('/').at(-1)!;
    decisions.push({ id, ...body });
    cases.splice(cases.findIndex((item) => item.id === id), 1);
    await route.fulfill({ status: 200, json: { case: { id, status: body.outcome } } });
  });
  await page.route('**/api/admin/media/qa-media-*', async (route) => {
    const body = route.request().postDataJSON() as { outcome: string; note: string };
    const id = route.request().url().split('/').at(-1)!;
    decisions.push({ id, ...body });
    media.splice(media.findIndex((item) => item.id === id), 1);
    await route.fulfill({ status: 200, json: { media: { id, status: body.outcome } } });
  });
  await page.getByRole('button', { name: 'Refresh' }).click();
  await section(page, 'Reports').click();
  for (const [outcome, button] of [['dismissed', 'Dismiss'], ['warned', 'Record warning'], ['suspended', 'Suspend account']]) {
    const row = page.locator('.admin-panel .admin-item').filter({ hasText: `QA ${outcome}` });
    await row.getByRole('button', { name: 'Review' }).click();
    await row.getByLabel('Decision note · required').fill(`Reviewed synthetic ${outcome} case.`);
    await row.getByRole('button', { name: button }).click();
    await expect(row).toHaveCount(0);
  }
  await section(page, 'Media').click();
  for (const [outcome, button] of [['approved', 'Approve'], ['rejected', 'Reject']]) {
    const row = page.locator('.admin-media-item').filter({ hasText: `QA ${outcome}` });
    await row.getByRole('button', { name: 'Review' }).click();
    await row.getByLabel('Decision note · required').fill(`Reviewed synthetic ${outcome} media.`);
    await row.getByRole('button', { name: button }).click();
    await expect(row).toHaveCount(0);
  }
  expect(decisions.map(({ id, outcome }) => [id, outcome])).toEqual([
    ['qa-report-dismissed', 'dismissed'], ['qa-report-warned', 'warned'],
    ['qa-report-suspended', 'suspended'], ['qa-media-approved', 'approved'],
    ['qa-media-rejected', 'rejected'],
  ]);
  expect(decisions.every(({ note }) => note.startsWith('Reviewed synthetic'))).toBe(true);
});

test('billing can prepare a Lift reissue without altering a store subscription', async ({ page }) => {
  await signIn(page);
  await section(page, 'People').click();
  await page.getByLabel('Find a person or ask a question').fill('test002@spikedate.test');
  await page.getByRole('button', { name: 'Search people' }).click();
  await page.locator('.admin-people-directory .admin-item').filter({ hasText: 'test002@spikedate.test' }).getByRole('button', { name: 'Open account' }).click();
  await expect(page.getByText('Account record', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Account details' }).getByRole('button', { name: 'Billing' }).click();
  const submissions: Array<{ kind: string; amount: number; reason: string; requestId: string }> = [];
  await page.route('**/api/admin/users/test-002/credits', async (route) => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: { ok: true } });
  });
  await page.locator('.admin-credit-form select').selectOption('profile_lift');
  await page.getByRole('spinbutton', { name: 'Credit quantity' }).fill('2');
  await page.getByPlaceholder('Why are these credits being granted?').fill('Synthetic Lift reissue review.');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Grant credits' }).click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0]).toMatchObject({ kind: 'profile_lift', amount: 2, reason: 'Synthetic Lift reissue review.' });
  expect(submissions[0].requestId).toMatch(/^[0-9a-f-]{36}$/i);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
