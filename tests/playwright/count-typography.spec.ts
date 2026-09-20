import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test('Home counts and Profile Lift icon match across five themes', async ({
  page,
}, info) => {
  await loginSynthetic(page, info.project.name === 'android-mobile' ? 43 : 42);
  for (const theme of [
    'default',
    'electric-blue',
    'spring-green',
    'neon-orchid',
    'vermilion',
  ]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.pulseTheme = 'default';
      if (theme === 'default') {
        delete document.documentElement.dataset.pulseAccent;
      } else {
        document.documentElement.dataset.pulseAccent = theme;
      }
    }, theme);
    const fresh = page.locator('.today-count-badge');
    await expect(fresh).toBeVisible();
    // Zero-count badges are correctly absent. Inject fixture-only digits to
    // inspect each actual badge class without sending a message or Like.
    await page.evaluate(() => {
      const filter = document.querySelector('.filter-button');
      if (filter && !filter.querySelector('span')) {
        const el = document.createElement('span');
        el.textContent = '2';
        el.dataset.countFixture = 'true';
        filter.appendChild(el);
      }
      for (const name of ['Likes', 'Chat']) {
        const icon = [...document.querySelectorAll('.tabbar button')]
          .find((el) => el.querySelector('.tab-label')?.textContent === name)
          ?.querySelector('.tab-icon');
        if (icon && !icon.querySelector('.tab-badge')) {
          const el = document.createElement('b');
          el.className = `tab-badge${name === 'Likes' ? ' likes' : ''}`;
          el.textContent = '9+';
          el.dataset.countFixture = 'true';
          icon.appendChild(el);
        }
      }
    });
    for (const selector of [
      '.filter-button > span',
      '.tab-badge.likes',
      '.tab-badge:not(.likes)',
      '.today-count-badge',
    ]) {
      const count = page.locator(selector).first();
      await expect(count).toBeVisible();
      await expect(count).toHaveCSS('font-size', '12px');
      await expect(count).toHaveCSS('font-weight', '300');
      await expect(count).toHaveCSS('line-height', '16px');
      await expect(count).toHaveCSS('font-variant-numeric', 'tabular-nums');
      await expect(count).toHaveCSS('text-shadow', 'none');
      expect(
        await count.evaluate((el) => getComputedStyle(el).fontFamily),
      ).toContain('Inter');
    }
    const badgeColors = await page.evaluate(() =>
      ['.filter-button > span', '.tab-badge.likes', '.tab-badge:not(.likes)'].map(
        (selector) => {
          const style = getComputedStyle(document.querySelector(selector)!);
          return [style.backgroundColor, style.color, style.height];
        },
      ),
    );
    expect(badgeColors[0]).toEqual(badgeColors[1]);
    expect(badgeColors[2]).toEqual(badgeColors[1]);
    await info.attach(`${theme}-light-counts`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  }
  for (let tabIndex = 0; tabIndex < 5; tabIndex += 1) {
    await page.locator('.tabbar button').nth(tabIndex).click();
    const lift = page.locator('.global-boost-button .profile-lift-mark svg');
    await expect(lift).toBeVisible();
    await expect(lift).toHaveAttribute('fill', 'currentColor');
  }
  await page.getByRole('button', { name: 'Lift my profile' }).click();
  await expect(page.locator('.boost-dialog .profile-lift-mark svg').first()).toHaveAttribute(
    'fill',
    'currentColor',
  );
});
