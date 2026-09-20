const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const out = path.resolve('outputs/qa/editorial-midnight');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const result = {
      url: 'https://spikedate-stage.sarathnice.workers.dev/',
      checkedAt: new Date().toISOString(),
      actual: {},
      preview: {},
      checks: [],
    };
    async function metric(selector, properties) {
      return page
        .locator(selector)
        .first()
        .evaluate((el, props) => {
          const style = getComputedStyle(el);
          return Object.fromEntries(props.map((prop) => [prop, style[prop]]));
        }, properties);
    }
    const roles = {
      name: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'],
      caption: [
        'fontSize',
        'fontWeight',
        'lineHeight',
        'letterSpacing',
        'textTransform',
      ],
      answer: ['fontSize', 'fontWeight', 'lineHeight'],
      factsCaption: ['fontSize', 'fontWeight', 'lineHeight'],
      factsAnswer: ['fontSize', 'fontWeight', 'lineHeight'],
      section: ['paddingTop', 'paddingBottom'],
      content: ['paddingLeft', 'paddingRight'],
      title: ['fontSize', 'fontWeight', 'letterSpacing'],
      label: ['fontSize', 'fontWeight', 'letterSpacing'],
      input: [
        'fontSize',
        'fontWeight',
        'paddingLeft',
        'paddingRight',
        'borderRadius',
      ],
    };
    await page.goto(result.url);
    await page
      .getByLabel('Test profile')
      .selectOption('test042@spikedate.test');
    await page
      .getByRole('button', { name: /Fill selected test login/i })
      .click();
    await page.getByRole('button', { name: 'Sign in to SpikeDate' }).click();
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.passport-details-list').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, 'profile-mobile.png') });
    result.ownCaption = await metric(
      '.passport-details-list .setting-heading small',
      roles.caption,
    );
    result.ownAnswer = await metric(
      '.passport-details-list .setting-heading strong',
      roles.answer,
    );
    await page.getByRole('button', { name: /Preview my card/i }).click();
    await page
      .getByRole('button', { name: 'Open your full profile preview' })
      .click();
    await page.locator('.profile-preview-sheet').waitFor();
    await page.waitForTimeout(500);
    const actualSelectors = {
      name: '.profile-title h2',
      caption: '.passport-story .section-label',
      answer: '.passport-story p',
      factsCaption: '.full-passport-facts small',
      factsAnswer: '.full-passport-facts strong',
      section: '.passport-story',
      content: '.profile-details',
    };
    for (const [key, selector] of Object.entries(actualSelectors))
      result.actual[key] = await metric(selector, roles[key]);
    await page.locator('.passport-story').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(out, 'full-profile-details-mobile.png'),
    });
    result.retainedPhotoHeight = await page
      .locator('.profile-film')
      .evaluate((el) => el.getBoundingClientRect().height);
    await page.getByRole('button', { name: 'Close full profile' }).click();
    await page.getByRole('button', { name: 'Back to profile' }).click();
    await page
      .getByRole('button', { name: 'Edit profile', exact: true })
      .click();
    await page.locator('.registration-dialog').waitFor();
    await page.waitForTimeout(400);
    for (const [key, selector] of Object.entries({
      title: '.registration-dialog [data-slot="dialog-title"]',
      label: '.registration-dialog .field-label',
      input: '.registration-dialog .field-grid input',
    }))
      result.actual[key] = await metric(selector, roles[key]);
    await page.screenshot({ path: path.join(out, 'registration-mobile.png') });
    await page.goto(
      'file:///C:/Users/sarat/.codex/visualizations/2026/09/07/01a07cc5-af40-7400-ac43-a22e5174ebc9/spikedate-personal-editorial.html',
    );
    await page.evaluate(() => document.fonts.ready);
    const previewSelectors = {
      name: '.sd-photo-name h1',
      caption: '.sd-section:nth-child(2) h2',
      answer: '.sd-section:nth-child(2) p',
      factsCaption: '.sd-facts small',
      factsAnswer: '.sd-facts p',
      section: '.sd-section:nth-child(2)',
      content: '.sd-content',
    };
    for (const [key, selector] of Object.entries(previewSelectors))
      result.preview[key] = await metric(
        '[data-design="a"] ' + selector,
        roles[key],
      );
    await page
      .getByRole('button', { name: 'Registration / edit', exact: true })
      .click();
    for (const [key, selector] of Object.entries({
      title: '.sd-form-title',
      label: '.sd-form label',
      input: '.sd-form input',
    }))
      result.preview[key] = await metric(
        '[data-design="a"] ' + selector,
        roles[key],
      );
    for (const key of Object.keys(roles))
      for (const prop of roles[key])
        result.checks.push({
          role: key,
          property: prop,
          actual: result.actual[key][prop],
          preview: result.preview[key][prop],
          passed: result.actual[key][prop] === result.preview[key][prop],
        });
    result.intentionalDifferences = [
      'Large photo-first hero retained rather than the illustrative 300px preview crop',
      'Current branding and user-selected theme colors retained',
      'Eight editable registration sections and required/optional indicators retained',
      'Existing sticky reply and profile safety/navigation controls retained',
    ];
    fs.writeFileSync(
      path.join(out, 'preview-parity.json'),
      JSON.stringify(result, null, 2),
    );
    const failed = result.checks.filter((check) => !check.passed);
    console.log(JSON.stringify({ total: result.checks.length, failed }));
    if (failed.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
