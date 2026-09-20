import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

const variants = [
  { id: 'electric-blue', name: 'Electric Blue', accent: '#3978ff', secondary: '#7ea7ff' },
  { id: 'spring-green', name: 'Spring Green', accent: '#75eb8a', secondary: '#b8f6c2' },
  { id: 'neon-orchid', name: 'Neon Orchid', accent: '#c05cff', secondary: '#dda3ff' },
  { id: 'vermilion', name: 'Vermilion', accent: '#f45e3f', secondary: '#ff9a75' },
] as const;

const toRgb = (hex: string) => {
  const [red, green, blue] = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16));
  return `rgb(${red}, ${green}, ${blue})`;
};

test.skip(
  ({ baseURL }) => !['3007', '3012'].includes(new URL(baseURL!).port),
  'Local synthetic accounts only.',
);

test('retained color themes keep Midnight layout and persist across reloads', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await loginSynthetic(page, 1);
  await expect(page.locator('html')).toHaveAttribute('data-pulse-accent', 'vermilion');

  const midnight = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const bounds = (selector: string) => {
      const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      background: style.getPropertyValue('--background').trim(),
      nav: style.getPropertyValue('--nav-bg').trim(),
      surface: style.getPropertyValue('--surface').trim(),
      frame: bounds('.phone-frame'),
    };
  });

  for (const variant of variants) {
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: /App theme/ }).click();
    const chooser = page.locator('.theme-dialog');
    await expect(chooser.locator('[data-theme-choice]')).toHaveCount(5);
    await chooser.locator(`[data-theme-choice="${variant.id}"]`).click();

    await expect(page.locator('html')).toHaveAttribute('data-pulse-theme', 'default');
    await expect(page.locator('html')).toHaveAttribute('data-pulse-accent', variant.id);
    await expect(page.getByRole('button', { name: /App theme/ })).toContainText(variant.name);
    expect(await page.evaluate(() => localStorage.getItem('pulse-theme'))).toBe(variant.id);

    await page.reload();
    await expect(page.locator('.phone-frame')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-pulse-theme', 'default');
    await expect(page.locator('html')).toHaveAttribute('data-pulse-accent', variant.id);

    const actual = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const frame = document.querySelector('.phone-frame')!.getBoundingClientRect();
      const nav = document.querySelector('.tabbar')!.getBoundingClientRect();
      const bounds = (selector: string) => {
        const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        background: style.getPropertyValue('--background').trim(),
        nav: style.getPropertyValue('--nav-bg').trim(),
        surface: style.getPropertyValue('--surface').trim(),
        frame: bounds('.phone-frame'),
        accent: style.getPropertyValue('--coral').trim(),
        brand: getComputedStyle(document.querySelector('.brand-symbol')!).color,
        date: getComputedStyle(document.querySelector('.brand-date')!).color,
        boost: getComputedStyle(document.querySelector('.global-boost-button')!).color,
        navFits: nav.left >= frame.left && nav.right <= frame.right + 1,
      };
    });
    expect(actual).toMatchObject({
      ...midnight,
      accent: variant.accent,
      navFits: true,
    });
    expect(actual.brand).toBe(toRgb(variant.accent));
    expect(actual.date).toBe(toRgb(variant.secondary));
    expect(actual.boost).toBe(toRgb(variant.secondary));
    await expect(page.locator('.phone-frame')).toBeVisible();

    await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
    await expect(page.locator('.phone-frame')).toHaveAttribute('data-active-tab', 'Galaxy');
    await page.getByRole('button', { name: /^Likes/ }).click();
    await expect(page.locator('.phone-frame')).toHaveAttribute('data-active-tab', 'Likes');
    await page.getByRole('button', { name: /^Chat/ }).click();
    await expect(page.locator('.phone-frame')).toHaveAttribute('data-active-tab', 'Chat');
    const chatAccent = await page.locator('.phone-frame').evaluate((frame) =>
      getComputedStyle(frame).getPropertyValue('--chat-accent').trim(),
    );
    expect(chatAccent).toBe(variant.accent);
  }

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: /App theme/ }).click();
  await page.locator('[data-theme-choice="default"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-pulse-theme', 'default');
  await expect(page.locator('html')).not.toHaveAttribute('data-pulse-accent');
  expect(await page.evaluate(() => localStorage.getItem('pulse-theme'))).toBe('default');
});

test('removed saved themes fall back to Vermilion', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pulse-theme', 'saffron'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-pulse-theme', 'default');
  await expect(page.locator('html')).toHaveAttribute('data-pulse-accent', 'vermilion');
  expect(await page.evaluate(() => localStorage.getItem('pulse-theme'))).toBe('vermilion');
});
