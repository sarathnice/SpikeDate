import { expect, test, type Locator } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

async function checkType(element: Locator, size: string, weight = '400') {
  await expect(element).toHaveCSS('font-size', size);
  await expect(element).toHaveCSS('font-weight', weight);
  await expect(element).toHaveCSS('font-style', 'normal');
  expect(
    await element.evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain('Inter');
}

async function auditVisibleText(container: Locator) {
  const mismatches = await container
    .locator('h1,h2,h3,p,strong,b,small,label,span,input,select,textarea')
    .evaluateAll((elements) =>
      elements.flatMap((el) => {
        const style = getComputedStyle(el);
        const hasText = [...el.childNodes].some(
          (node) =>
            node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        );
        const field = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
        if (!el.getClientRects().length || (!hasText && !field)) return [];
        if (
          ['400', '500'].includes(style.fontWeight) &&
          style.fontStyle === 'normal' &&
          style.fontFamily.includes('Inter') &&
          [
            '11px',
            '12px',
            '12.64px',
            '13px',
            '14px',
            '16px',
            '20px',
            '23px',
            '24px',
            '26px',
            '28px',
            '22px',
          ].includes(style.fontSize)
        )
          return [];
        return [
          {
            text: el.textContent?.trim().slice(0, 65),
            size: style.fontSize,
            weight: style.fontWeight,
            family: style.fontFamily,
          },
        ];
      }),
    );
  expect(
    mismatches,
    'Visible text uses Quiet Precision roles without heavy legacy overrides',
  ).toEqual([]);
}

test('profile typography: Quiet Precision create-account text and fields', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Create account', exact: true }).click();
  const signup = page.locator('.auth-card[data-auth-mode="signup"]');
  await expect(signup).toBeVisible();
  await auditVisibleText(signup.locator('.auth-copy'));
  await auditVisibleText(signup.locator('.auth-form'));
  await checkType(
    signup.getByRole('textbox', { name: 'Mobile number' }),
    '16px',
  );
  await checkType(signup.locator('.auth-copy h1'), '23px', '500');
  await info.attach('sharp-mobile-create-account', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('profile typography: Quiet Precision across five themes and eight registration sections', async ({
  page,
}, info) => {
  test.setTimeout(240000);
  await loginSynthetic(page, info.project.name === 'android-mobile' ? 43 : 42);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  for (const theme of [
    'default',
    'electric-blue',
    'spring-green',
    'neon-orchid',
    'vermilion',
  ]) {
    await page.getByRole('button', { name: /^App theme/ }).click();
    await page.locator('[data-theme-choice="' + theme + '"]').click();
    await expect(page.locator('.toast')).not.toHaveClass(/\bshow\b/);
    const notifications = page.locator('.push-settings-card');
    for (const disclosure of [
      notifications,
      page.locator('.engagement-settings-card'),
    ]) {
      if ((await disclosure.getAttribute('open')) === null)
        await disclosure.locator(':scope > summary').click();
    }
    const idea = page
      .locator('.engagement-setting-toggle')
      .filter({ hasText: 'Share your Today' });
    await checkType(idea.locator('strong'), '12.64px', '500');
    await checkType(idea.locator('p'), '12px');
    await checkType(
      notifications.getByText('Choose what reaches you'),
      '14px',
      '500',
    );
    await checkType(
      notifications.getByText('New matches', { exact: true }),
      '12.64px',
      '500',
    );
    await checkType(
      notifications.getByText('Mutual connections', { exact: true }),
      '12px',
    );
    await checkType(
      page.locator('.profile-passport-identity h1'),
      '24px',
      '500',
    );
    await checkType(
      page.locator('.passport-details-list .setting-heading small').first(),
      '12.64px',
    );
    await checkType(
      page.locator('.passport-details-list .setting-heading strong').first(),
      '12px',
    );
    await auditVisibleText(page.locator('.profile-page'));
    await notifications.scrollIntoViewIfNeeded();
    const row = notifications.locator('.push-setting-toggle').first();
    const label = (await row.locator('strong').boundingBox())!;
    const toggle = (await row.getByRole('switch').boundingBox())!;
    expect(label.x + label.width).toBeLessThan(toggle.x);
    await info.attach(theme + '-sharp-mobile-notifications', {
      body: await notifications.screenshot(),
      contentType: 'image/png',
    });
    await page.getByRole('button', { name: 'Preview my profile card' }).click();
    await checkType(
      page.locator('.preview-screen .name-row h1'),
      '28px',
      '500',
    );
    await page
      .getByRole('button', { name: 'Open your full profile preview' })
      .click();
    const full = page.locator('.profile-preview-sheet');
    await checkType(full.locator('.profile-title h2'), '26px', '500');
    await checkType(full.locator('.passport-story .section-label'), '11px');
    await checkType(full.locator('.passport-story p'), '12.64px');
    await checkType(
      full.locator('.full-passport-facts strong').first(),
      '12px',
    );
    await checkType(full.locator('.full-passport-facts small').first(), '11px');
    const factsLayout = await full
      .locator('.full-passport-facts')
      .first()
      .evaluate((el) => ({
        columns: getComputedStyle(el).gridTemplateColumns.split(' ').length,
        overflow: el.scrollWidth > el.clientWidth + 1,
      }));
    expect(factsLayout).toEqual({ columns: 4, overflow: false });
    for (const caption of [
      'Height',
      'Open to kids',
      'Work',
      'Gender',
      'Have kids',
      'Smoking',
      'Drinking',
      'Workout',
      'Religion',
      'Education',
    ]) {
      const fact = full
        .locator('.full-passport-facts > div')
        .filter({ has: page.getByText(caption, { exact: true }) });
      await expect(fact).toBeVisible();
      await expect(fact.locator('svg')).toBeVisible();
      await expect(fact.locator('svg')).toHaveCSS('opacity', '0.84');
      await expect(fact).toHaveCSS('flex-direction', 'column');
      await checkType(fact.locator('small'), '11px');
      await checkType(fact.locator('strong'), '12px');
      await expect(fact.locator('strong')).not.toHaveText('');
    }
    await expect(full.locator('.passport-story .section-label')).toHaveText(
      'A little about me',
    );
    await expect(full.locator('.passport-story .section-label')).toHaveCSS(
      'text-transform',
      'uppercase',
    );
    await expect(full.locator('.profile-details')).toHaveCSS(
      'padding-left',
      '20px',
    );
    await expect(full.locator('.passport-story')).toHaveCSS(
      'padding-top',
      '0px',
    );
    const contrastRoles = await full.evaluate((el) => {
      const label = getComputedStyle(
        el.querySelector('.passport-story .section-label')!,
      );
      const answer = getComputedStyle(el.querySelector('.passport-story p')!);
      return {
        different: label.color !== answer.color,
        labelWeight: label.fontWeight,
        answerWeight: answer.fontWeight,
      };
    });
    expect(contrastRoles).toEqual({
      different: true,
      labelWeight: '400',
      answerWeight: '400',
    });
    await auditVisibleText(full.locator('.profile-details'));
    await info.attach(theme + '-sharp-mobile-full-profile', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await full.getByRole('button', { name: 'Close full profile' }).click();
    await page.getByRole('button', { name: 'Back to profile' }).click();
    await page
      .getByRole('button', { name: 'Edit profile', exact: true })
      .click();
    const edit = page.locator('.registration-dialog');
    await expect(edit).toBeVisible();
    await checkType(edit.locator('[data-slot="dialog-title"]'), '22px', '500');
    await checkType(edit.locator('[data-slot="dialog-description"]'), '12px');
    await checkType(edit.locator('.field-grid input').first(), '16px');
    await checkType(edit.locator('.field-label').first(), '12px');
    await expect(edit.locator('.field-grid label').first()).toHaveCSS(
      'gap',
      '7px',
    );
    await expect(edit.locator('.field-grid input').first()).toHaveCSS(
      'padding-left',
      '12px',
    );
    await expect(edit.locator('.field-grid input').first()).toHaveCSS(
      'border-radius',
      '13px',
    );
    await auditVisibleText(edit);
    await info.attach(theme + '-sharp-mobile-edit', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    if (theme === 'default') {
      for (let section = 2; section <= 8; section++) {
        await edit
          .getByRole('button', { name: 'Continue', exact: true })
          .click();
        await expect(edit.locator('.flow-kicker')).toContainText(
          section + ' OF 8',
        );
        await checkType(
          edit.locator('[data-slot="dialog-title"]'),
          '22px',
          '500',
        );
        await checkType(
          edit.locator('[data-slot="dialog-description"]'),
          '12px',
        );
        if (section === 2) {
          await edit.locator('.optional-fields-toggle').click();
          await expect(
            edit.getByRole('textbox', { name: 'Pronouns', exact: true }),
          ).toBeVisible();
        }
        for (const label of await edit.locator('.field-grid label').all()) {
          if (!(await label.isVisible())) continue;
          await checkType(label, '12px');
          const hierarchy = await label.evaluate((el) => {
            const field = el.querySelector('input,select,textarea');
            return (
              !field ||
              getComputedStyle(el).color !== getComputedStyle(field).color
            );
          });
          expect(
            hierarchy,
            'Plain field captions must be quieter than their editable values',
          ).toBe(true);
        }
        await auditVisibleText(edit);
        if (await edit.locator('.choice-group button').count())
          await checkType(
            edit.locator('.choice-group button').first(),
            '12.64px',
          );
        await info.attach('sharp-mobile-registration-' + section, {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }
    }
    await edit.getByRole('button', { name: 'Close registration' }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
});
