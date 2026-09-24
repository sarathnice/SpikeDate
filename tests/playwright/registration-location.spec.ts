import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';
import { syntheticProfiles } from '../../lib/synthetic-profiles';

test('registration inline location assist fills editable city and state', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 42.36, longitude: -71.06, accuracy: 50 });
  await page.route('**/api/registration-location/reverse', async (route) => {
    const input = route.request().postDataJSON() as { latitude: number; longitude: number };
    expect(input.latitude).toBeCloseTo(42.36, 2);
    expect(input.longitude).toBeCloseTo(-71.06, 2);
    await route.fulfill({ json: { area: { city: 'Boston', region: 'MA', country: 'US' } } });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  const email = `location-${Date.now()}@spikedate.test`;
  await page.getByLabel('Mobile number', { exact: true }).fill(`+1202555${String(Date.now()).slice(-4)}`);
  await page.getByRole('button', { name: /Send code/ }).click();
  const message = page.locator('.auth-phone-message');
  await expect(message).toContainText(/(?:Local test|Preview) code/);
  const code = (await message.innerText()).match(/\d{6}/)![0];
  await page.getByLabel('Six-digit verification code').fill(code);
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('SpikeDate2026!');
  await page.getByLabel('Birthday').fill('1997-05-12');
  await page.getByLabel('Gender', { exact: true }).selectOption('Woman');
  await page.getByRole('checkbox', { name: /I am 18 or older/ }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  const dialog = page.locator('.registration-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Use current location' }).click();
  await expect(dialog.getByLabel('City', { exact: true })).toHaveValue('Boston');
  await expect(dialog.getByLabel('State', { exact: true })).toHaveValue('MA');
  await expect(dialog.getByText(/Suggested area added/)).toBeVisible();
  await dialog.getByLabel('City', { exact: true }).fill('Cambridge');
  await expect(dialog.getByLabel('City', { exact: true })).toHaveValue('Cambridge');
  expect(await dialog.evaluate((node) => node.getBoundingClientRect().right <= innerWidth + 1)).toBe(true);
});

test('new synthetic cohort can sign in and display its profile photo', async ({ page }) => {
  await loginSynthetic(page, 51);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`^${syntheticProfiles[50].name},`) })).toBeVisible();
  await expect(page.getByText('Boston, MA · Engineer')).toBeVisible();
  const photo = page.locator('.own-photo-grid img').first();
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});
