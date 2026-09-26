import { expect, test, type Page } from '@playwright/test';

function section(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: new RegExp(`^${name}(?:\\s|$)`) });
}

test('staff completes real local report, privacy, account, credit, and audit workflows', async ({ page }) => {
  test.skip(process.env.SPIKEDATE_ADMIN_MUTATION_TESTS !== '1' || !process.env.SPIKEDATE_UI_URL?.startsWith('http://127.0.0.1:'), 'Mutating staff workflow runs only with explicit opt-in against the local synthetic database.');
  const marker = `Admin desktop QA ${Date.now()}`;
  const userLogin = await page.request.post('/api/auth/login', { data: { email: 'test002@spikedate.test', password: 'SpikeDate2026!' } });
  expect(userLogin.ok()).toBe(true);
  const report = await page.request.post('/api/safety', { data: { targetUserId: 'test-003', action: 'report', reason: 'QA workflow', details: marker } });
  expect(report.status()).toBe(201);
  const privacy = await page.request.post('/api/privacy/requests', { data: { kind: 'export' } });
  expect([200, 201]).toContain(privacy.status());
  await page.request.post('/api/auth/logout');

  await page.goto('/admin');
  await page.getByLabel('Email address').fill('test001@spikedate.test');
  await page.getByLabel('Password').fill('SpikeDate2026!');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

  await section(page, 'Reports').click();
  const caseRow = page.locator('.admin-panel .admin-item').filter({ hasText: marker });
  await expect(caseRow).toBeVisible();
  await caseRow.getByRole('button', { name: 'Review' }).click();
  await caseRow.getByLabel('Decision note · required').fill(`${marker}: checked synthetic report.`);
  await caseRow.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(caseRow).toHaveCount(0);

  await section(page, 'Privacy').click();
  const privacyRow = page.locator('.admin-panel .admin-item').filter({ hasText: 'test002@spikedate.test' });
  await expect(privacyRow).toBeVisible();
  if (await privacyRow.getByRole('button', { name: 'Review' }).count()) {
    await privacyRow.getByRole('button', { name: 'Review' }).click();
    await privacyRow.getByLabel('Decision note · required').fill(`${marker}: acknowledged synthetic export request.`);
    await privacyRow.getByRole('button', { name: 'Mark in progress' }).click();
    await expect(privacyRow.getByText('processing')).toBeVisible();
  }

  await section(page, 'People').click();
  const search = page.getByLabel('Find a person or ask a question');
  await search.fill('test003@spikedate.test');
  await page.getByRole('button', { name: 'Search people' }).click();
  const person = page.locator('.admin-people-directory .admin-item').filter({ hasText: 'test003@spikedate.test' });
  await expect(person).toBeVisible();
  await person.getByRole('button', { name: 'Review' }).click();
  await person.getByLabel('Decision note · required').fill(`${marker}: temporary synthetic suspension.`);
  page.once('dialog', (dialog) => dialog.accept());
  await person.getByRole('button', { name: 'Suspend account' }).click();
  await expect(person.getByText('suspended', { exact: true })).toBeVisible();
  await person.getByRole('button', { name: 'Review' }).click();
  await person.getByLabel('Decision note · required').fill(`${marker}: restore after test.`);
  page.once('dialog', (dialog) => dialog.accept());
  await person.getByRole('button', { name: 'Restore account' }).click();
  await expect(person.getByText('active', { exact: true })).toBeVisible();

  await person.getByRole('button', { name: 'Open account' }).click();
  await expect(page.getByText('Account record', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Account details' }).getByRole('button', { name: 'Billing' }).click();
  const spikes = page.locator('.admin-detail-grid > div').filter({ hasText: 'Available Spikes' }).locator('strong');
  const before = Number(await spikes.innerText());
  await page.getByRole('spinbutton', { name: 'Credit quantity' }).fill('1');
  await page.getByPlaceholder('Why are these credits being granted?').fill(`${marker}: synthetic replacement credit.`);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Grant credits' }).click();
  await expect(spikes).toHaveText(String(before + 1));
  await expect(page.getByText(`${marker}: synthetic replacement credit.`, { exact: false })).toBeVisible();

  await section(page, 'Activity').click();
  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
  await expect(page.locator('.admin-audit-item').filter({ hasText: /admin\.user\.(suspend|restore)|admin\.credit/ }).first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
