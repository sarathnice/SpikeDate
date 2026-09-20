// Read-only UI typography inventory. Never submits registration, notes or purchases.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const base =
  process.env.SPIKEDATE_UI_URL ||
  'https://spikedate-stage.sarathnice.workers.dev';
const out = path.resolve(
  process.env.SPIKEDATE_TYPOGRAPHY_REPORT_DIR ||
    'outputs/qa/typography-inventory-2026-09-16',
);
const allSizes = [
  [320, 740],
  [360, 640],
  [390, 844],
  [412, 915],
  [768, 1024],
  [1024, 768],
  [1440, 900],
];
const iphone17 = process.env.SPIKEDATE_TYPOGRAPHY_DEVICE === 'iphone17';
const sizes = iphone17 ? [[402, 874]] : process.env.SPIKEDATE_TYPOGRAPHY_MOBILE_ONLY === 'true'
  ? [[390, 844]] : allSizes;
const records = [];
const failures = [];
const skipped = [];
const checks = [];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge' });
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, ...(iphone17 ? {deviceScaleFactor:3,isMobile:true,hasTouch:true} : {}) });
    if (process.env.SPIKEDATE_TYPOGRAPHY_THEME) {
      await context.addInitScript(theme => localStorage.setItem('pulse-theme', theme), process.env.SPIKEDATE_TYPOGRAPHY_THEME);
    }
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const viewport = `${width}x${height}`;
    async function capture(screen, selector) {
      const root = page.locator(selector).first();
      await root.waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
      if (process.env.SPIKEDATE_TYPOGRAPHY_COMPARE === 'true') await page.waitForTimeout(350);
      const text = await root.evaluate((el) =>
        [
          ...el.querySelectorAll(
            'h1,h2,h3,h4,p,strong,b,em,i,small,label,span,button,a,input,select,textarea,.bubble,.day-label',
          ),
        ].flatMap((node) => {
          const style = getComputedStyle(node);
          const direct = [...node.childNodes]
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent.trim())
            .join(' ')
            .trim();
          const field = ['INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName);
          if (
            (!direct && !field) ||
            !node.getClientRects().length ||
            style.visibility === 'hidden' ||
            parseFloat(style.fontSize) === 0 ||
            node.closest('.sr-only')
          )
            return [];
          const rect = node.getBoundingClientRect();
          return [
            {
              brand: !!node.closest('.brand-wordmark,.admin-brand'),
              tag: node.tagName,
              className: node.className,
              text: (
                direct ||
                node.getAttribute('aria-label') ||
                node.getAttribute('placeholder') ||
                node.tagName
              ).slice(0, 80),
              font: style.fontFamily,
              size: parseFloat(style.fontSize),
              weight: style.fontWeight,
              style: style.fontStyle,
              lineHeight: style.lineHeight,
              color: style.color,
              inViewport: rect.top >= 0 && rect.bottom <= innerHeight,
              x: rect.x,
              width: rect.width,
            },
          ];
        }),
      );
      records.push({ viewport, screen, text });
      if (process.env.SPIKEDATE_TYPOGRAPHY_COMPARE === 'true') {
        const stem = `${viewport}-${screen.replace(/\W+/g, '-').toLowerCase()}`;
        await page.screenshot({ path: path.join(out, `${stem}-current.png`), animations: 'disabled' });
        const proposal = await root.evaluate((el, stronger) => {
          const nodes = [...el.querySelectorAll('h1,h2,h3,h4,p,strong,b,em,i,small,label,span,button,a,input,select,textarea,.bubble,.day-label')];
          const changes = [];
          for (const node of nodes) {
            if (node.closest('.brand-wordmark,.admin-brand,.sr-only')) continue;
            const current = getComputedStyle(node);
            if (!node.getClientRects().length) continue;
            const tag = node.tagName;
            const size = parseFloat(current.fontSize);
            const fromWeight = current.fontWeight;
            const classes = String(node.className);
            let weight = '400', nextSize = size;
            if (/tab-badge|today-count-badge/.test(classes) || node.matches('.filter-button > span')) {
              weight = '300'; nextSize = 12;
            } else if (/^H[12]$/.test(tag)) {
              weight = size >= 24 ? '350' : '400'; nextSize = size >= 24 ? 26 : 20;
            } else if (/^H[34]$/.test(tag)) {
              weight = '400'; nextSize = 14;
            } else if (['INPUT','SELECT','TEXTAREA'].includes(tag)) {
              weight = '400'; nextSize = 16;
            } else if (tag === 'LABEL' || /field-label/.test(classes)) {
              weight = '350'; nextSize = 13;
            } else if (tag === 'SMALL' || /eyebrow|kicker|list-label|tab-label/.test(classes) || size <= 12.64) {
              weight = '350'; nextSize = Math.max(12, size);
            } else if (tag === 'BUTTON' || node.closest('button')) {
              weight = '400';
            } else if (size >= 18) {
              weight = '400';
            }
            if (stronger) {
              if (/^H[1-4]$/.test(tag) || tag === 'LABEL' || /field-label/.test(classes) || tag === 'SMALL' || /eyebrow|kicker|list-label|tab-label/.test(classes) || size <= 12.64) weight = '300';
              else if (['INPUT','SELECT','TEXTAREA'].includes(tag) || tag === 'BUTTON' || node.closest('button')) weight = '400';
              else weight = '350';
            }
            node.dataset.typographyOriginalStyle = node.getAttribute('style') ?? '__absent__';
            node.style.setProperty('font-weight', weight, 'important');
            node.style.setProperty('font-size', `${nextSize}px`, 'important');
            node.style.setProperty('font-style', 'normal', 'important');
            changes.push({ text: node.textContent.trim().slice(0,80), fromSize: size, fromWeight, size: nextSize, weight });
          }
          return changes;
        }, process.env.SPIKEDATE_TYPOGRAPHY_STRONGER === 'true');
        await page.screenshot({ path: path.join(out, `${stem}-recommended.png`), animations: 'disabled' });
        await root.evaluate(el => {
          for (const node of el.querySelectorAll('[data-typography-original-style]')) {
            const original = node.dataset.typographyOriginalStyle;
            if (original === '__absent__') node.removeAttribute('style');
            else node.setAttribute('style', original);
            delete node.dataset.typographyOriginalStyle;
          }
        });
        records.at(-1).comparison = { current: `${stem}-current.png`, recommended: `${stem}-recommended.png`, proposal };
      }
      if (process.env.SPIKEDATE_EXPECT_QUIET_PRECISION === 'true') {
        const mismatches = text.filter(
          (t) =>
            !t.brand &&
            (!t.font.includes('Inter') ||
              !['400', '500'].includes(t.weight) ||
              t.style !== 'normal' ||
              t.size < 11),
        );
        checks.push({
          viewport,
          screen,
          check: 'Quiet Precision family, weight and minimum size',
          passed: mismatches.length === 0,
          mismatches,
        });
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      checks.push({
        viewport,
        screen,
        check: 'document horizontal overflow',
        passed: !overflow,
      });
      const nav = page.locator('.tabbar');
      if (
        (await nav.isVisible()) &&
        !(await page.locator('[role="dialog"]').count())
      ) {
        const bounds = await nav.boundingBox();
        checks.push({
          viewport,
          screen,
          check: 'navigation inside viewport',
          passed: bounds.y >= 0 && bounds.y + bounds.height <= height + 1,
        });
      }
      console.log(`${viewport}: ${screen}: ${text.length} text elements`);
    }
    async function scenario(name, action) {
      try {
        await action();
      } catch (error) {
        failures.push({
          viewport,
          scenario: name,
          error: error.message.slice(0, 700),
        });
        await page
          .screenshot({
            path: path.join(
              out,
              `${viewport}-${name.replace(/\W/g, '-')}-error.png`,
            ),
          })
          .catch(() => {});
        await page.keyboard.press('Escape').catch(() => {});
        console.log(
          `FAILED ${viewport} ${name}: ${error.message.slice(0, 100)}`,
        );
      }
    }
    await page.goto(base);
    await capture('Login', '.auth-card');
    await page
      .getByRole('tab', { name: 'Create account', exact: true })
      .click();
    await capture('Create account', '.auth-card');
    await page.getByRole('tab', { name: 'Sign in', exact: true }).click();
    await page
      .getByLabel('Test profile')
      .selectOption('test042@spikedate.test');
    await page
      .getByRole('button', { name: /Fill selected test login/i })
      .click();
    await page.getByRole('button', { name: 'Sign in to SpikeDate' }).click();
    await page.getByRole('button', { name: 'Profile', exact: true }).waitFor();
    for (const name of [/^Dismiss /i, /^Later$/, /^Maybe later$/]) {
      const button = page.getByRole('button', { name }).first();
      if (await button.isVisible().catch(() => false)) await button.click();
    }
    await page
      .getByRole('button', { name: /Open .* full profile/i })
      .first()
      .waitFor({ state: 'visible', timeout: 15000 })
      .catch(() => {});
    await capture('Home', '.phone-frame');
    if ([360, 390, 1440].includes(width))
      await page.screenshot({ path: path.join(out, `${viewport}-home.png`) });
    await scenario('Filters', async () => {
      await page.getByRole('button', { name: 'Filter profiles' }).click();
      await capture('Filters', '.filter-dialog');
      await page.getByRole('button', { name: 'Close filters' }).click();
    });
    await scenario('Today', async () => {
      await page
        .getByRole('button', { name: 'Post or edit your Today update' })
        .first()
        .click();
      await capture('Today', '.today-composer-dialog');
      await page.getByRole('button', { name: 'Close Today composer' }).click();
    });
    await scenario('Other full profile', async () => {
      const open = page
        .getByRole('button', { name: /Open .* full profile/i })
        .first();
      if (!(await open.isVisible())) {
        skipped.push({
          viewport,
          screen: 'Other full profile',
          reason: 'Discovery has no eligible card for this account',
        });
        return;
      }
      await open.click();
      await capture('Other full profile', '.profile-sheet');
      if (process.env.SPIKEDATE_TYPOGRAPHY_COMPARE === 'true') {
        await page.locator('.profile-sheet .full-profile-passport').scrollIntoViewIfNeeded();
        await capture('Full profile details', '.profile-sheet .full-profile-passport');
      }
      await page
        .locator('.profile-end-actions')
        .getByRole('button', { name: 'Report', exact: true })
        .click();
      await capture('Report confirmation', '.safety-dialog');
      await page
        .locator('.safety-dialog')
        .getByRole('button', { name: 'Cancel', exact: true })
        .click();
      await page.locator('.safety-dialog').waitFor({ state: 'hidden' });
      if (!(await page.locator('.profile-sheet').isVisible())) return;
      await page.getByRole('button', { name: 'Close full profile' }).click();
    });
    await scenario('Spike composer', async () => {
      const open = page
        .getByRole('button', { name: /Send .* a Spike introduction/ })
        .first();
      if (!(await open.isVisible())) {
        skipped.push({
          viewport,
          screen: 'Spike composer',
          reason: 'No unmatched discovery introduction action',
        });
        return;
      }
      await open.click();
      await capture('Spike composer', '.note-dialog');
      await page
        .getByRole('button', { name: 'Close Spike', exact: true })
        .click();
    });
    await scenario('Profile Lift', async () => {
      await page
        .getByRole('button', {
          name: /Lift my profile|View active Profile Lift/,
        })
        .first()
        .click();
      await capture('Profile Lift', '.boost-dialog');
      await page.getByRole('button', { name: 'Close Profile Lift' }).click();
    });
    for (const tab of ['Galaxy', 'Likes', 'Chat', 'Profile']) {
      await scenario(tab, async () => {
        await page
          .getByRole('button', {
            name: tab === 'Likes' ? /^Likes/ : tab === 'Chat' ? /^Chat/ : tab,
            exact: !['Likes', 'Chat'].includes(tab),
          })
          .first()
          .click();
        await capture(
          tab,
          tab === 'Galaxy'
            ? '.galaxy-hub'
            : tab === 'Likes'
              ? '.likes-screen'
              : tab === 'Chat'
                ? '.chat-screen'
                : '.profile-page',
        );
        if (tab === 'Profile' && process.env.SPIKEDATE_TYPOGRAPHY_COMPARE === 'true') {
          const settings = page.locator('.communication-settings');
          if (await settings.count()) {
            await settings.scrollIntoViewIfNeeded();
            await capture('Notifications and reminders', '.communication-settings');
            await page.locator('.profile-page').evaluate(el => el.scrollTop = 0);
          }
        }
        if (tab === 'Galaxy') {
          const plan = page.locator('.galaxy-plan-action');
          if (await plan.isVisible()) {
            await plan.click();
            const dialog = page
              .locator('.plan-dialog,.plan-safety-dialog')
              .first();
            await capture(
              'Plan builder or safety gate',
              '.plan-dialog,.plan-safety-dialog',
            );
            await page.keyboard.press('Escape');
          } else
            skipped.push({
              viewport,
              screen: 'Plan builder',
              reason: 'Date planning paused or unavailable',
            });
        }
        if (tab === 'Likes')
          for (const label of [/You liked/, /Matches/]) {
            await page.getByRole('tab', { name: label }).click();
            await capture(`Likes ${label.source}`, '.likes-screen');
          }
        if (tab === 'Chat') {
          const row = page.locator('.chat-row').first();
          if (await row.isVisible()) {
            await row.locator('.chat-conversation').click();
            await capture('Chat conversation', '.thread');
            await page.getByRole('button', { name: 'Back to chats' }).click();
          } else
            skipped.push({
              viewport,
              screen: 'Chat conversation',
              reason: 'Account has no conversations',
            });
        }
      });
    }
    await scenario('Subscription', async () => {
      await page.locator('#profile-subscription').click();
      await capture('Subscription monthly', '.subscription-dialog');
      await page.getByRole('button', { name: 'Weekly', exact: true }).click();
      await capture('Subscription weekly', '.subscription-dialog');
      await page
        .getByRole('button', { name: 'Close subscription details' })
        .click();
    });
    await scenario('Preview and registration', async () => {
      await page
        .getByRole('button', { name: 'Preview my profile card' })
        .click();
      await capture('My card preview', '.preview-screen');
      await page
        .getByRole('button', { name: 'Open your full profile preview' })
        .click();
      await capture('My full profile preview', '.profile-preview-sheet');
      if (process.env.SPIKEDATE_TYPOGRAPHY_COMPARE === 'true') {
        await page.locator('.profile-preview-sheet .full-profile-passport').scrollIntoViewIfNeeded();
        await capture('My full profile details', '.profile-preview-sheet .full-profile-passport');
      }
      if ([390, 1440].includes(width))
        await page.screenshot({
          path: path.join(out, `${viewport}-full-profile.png`),
        });
      await page.getByRole('button', { name: 'Close full profile' }).click();
      await page.getByRole('button', { name: 'Back to profile' }).click();
      await page
        .getByRole('button', { name: 'Edit profile', exact: true })
        .click();
      for (let step = 1; step <= 8; step++) {
        await capture(
          `Registration/edit section ${step}`,
          '.registration-dialog',
        );
        if (step < 8)
          await page
            .getByRole('button', { name: 'Continue', exact: true })
            .click();
      }
      await page.getByRole('button', { name: 'Close registration' }).click();
    });
    if (process.env.SPIKEDATE_TYPOGRAPHY_COMPARE === 'true') {
      await scenario('Populated chat preview', async () => {
        await context.clearCookies();
        await page.goto(base);
        await page.getByLabel('Test profile').selectOption('test001@spikedate.test');
        await page.getByRole('button', { name: /Fill selected test login/i }).click();
        await page.getByRole('button', { name: 'Sign in to SpikeDate' }).click();
        await page.getByRole('button', { name: /^Chat/ }).first().click();
        await page.locator('.chat-row').first().locator('.chat-conversation').click();
        await capture('Populated chat conversation', '.thread');
      });
    }
    await context.close();
    fs.writeFileSync(
      path.join(out, 'inventory.json'),
      JSON.stringify(
        {
          base,
          runAt: new Date().toISOString(),
          sizes,
          records,
          checks,
          failures,
          skipped,
        },
        null,
        2,
      ),
    );
  }
  await browser.close();
  if (failures.length || checks.some((check) => !check.passed))
    process.exitCode = 1;
  console.log(
    JSON.stringify({
      screenInstances: records.length,
      textMeasurements: records.reduce((n, r) => n + r.text.length, 0),
      checksPassed: checks.filter((c) => c.passed).length,
      checksFailed: checks.filter((c) => !c.passed).length,
      failures,
      skipped,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
