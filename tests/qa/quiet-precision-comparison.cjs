const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const out = path.resolve('outputs/qa/quiet-precision-confirmation');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const result = {
    url: 'https://spikedate-stage.sarathnice.workers.dev/',
    at: new Date().toISOString(),
    staging: {},
    preview: {},
  };
  async function metrics(selector) {
    return page
      .locator(selector)
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          text: el.textContent.trim().slice(0, 80),
          font: s.fontFamily,
          size: s.fontSize,
          weight: s.fontWeight,
          lineHeight: s.lineHeight,
          letterSpacing: s.letterSpacing,
          padding: s.padding,
          textTransform: s.textTransform,
          gap: s.gap,
        };
      });
  }
  await page.goto(result.url);
  await page.getByLabel('Test profile').selectOption('test042@spikedate.test');
  await page.getByRole('button', { name: /Fill selected test login/i }).click();
  await page.getByRole('button', { name: 'Sign in to SpikeDate' }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, 'actual-profile.png') });
  result.staging.profileName = await metrics('.profile-passport-identity h1');
  await page.getByRole('button', { name: /Preview my card/i }).click();
  await page
    .getByRole('button', { name: 'Open your full profile preview' })
    .click();
  await page.locator('.profile-preview-sheet').waitFor();
  await page.waitForTimeout(700);
  result.staging.fullName = await metrics('.profile-title h2');
  result.staging.fullBody = await metrics('.passport-story p');
  result.staging.fullSection = await metrics('.profile-details .section-label');
  result.staging.fullFactsLabel = await metrics('.full-passport-facts small');
  result.staging.fullPadding = await metrics('.profile-details');
  result.staging.hero = await page
    .locator('.profile-film')
    .evaluate((el) => ({ height: el.getBoundingClientRect().height }));
  const client = await page.context().newCDPSession(page);
  await client.send('DOM.enable');
  await client.send('CSS.enable');
  const { root } = await client.send('DOM.getDocument');
  const { nodeId } = await client.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: '.profile-title h2',
  });
  result.staging.renderedFonts = await client.send(
    'CSS.getPlatformFontsForNode',
    { nodeId },
  );
  await page.screenshot({ path: path.join(out, 'actual-full-profile.png') });
  await page.getByRole('button', { name: 'Close full profile' }).click();
  await page.getByRole('button', { name: 'Back to profile' }).click();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await page.locator('.registration-dialog').waitFor();
  await page.waitForTimeout(400);
  result.staging.registrationTitle = await metrics(
    '.registration-dialog [data-slot="dialog-title"]',
  );
  result.staging.registrationLabel = await metrics(
    '.registration-dialog .field-label',
  );
  result.staging.registrationField = await metrics(
    '.registration-dialog .field-grid input',
  );
  await page.screenshot({ path: path.join(out, 'actual-registration.png') });
  await page.goto(
    'file:///C:/Users/sarat/.codex/visualizations/2026/09/07/01a07cc5-af40-7400-ac43-a22e5174ebc9/spikedate-premium-type-options.html',
  );
  await page.evaluate(() => document.fonts.ready);
  result.preview.fullName = await metrics('[data-design="a"] .sto-caption h1');
  result.preview.fullBody = await metrics('[data-design="a"] .sto-section p');
  result.preview.fullSection = await metrics(
    '[data-design="a"] .sto-section h2',
  );
  result.preview.fullFactsLabel = await metrics(
    '[data-design="a"] .sto-facts small',
  );
  result.preview.fullPadding = await metrics('[data-design="a"] .sto-pad');
  result.preview.hero = await page
    .locator('[data-design="a"] .sto-hero')
    .evaluate((el) => ({ height: el.getBoundingClientRect().height }));
  await page
    .locator('[data-design="a"] .sto-phone')
    .screenshot({ path: path.join(out, 'preview-a-full-profile.png') });
  await page.getByRole('button', { name: 'Registration', exact: true }).click();
  result.preview.registrationTitle = await metrics(
    '[data-design="a"] .sto-pad h1',
  );
  result.preview.registrationLabel = await metrics('[data-design="a"] label');
  result.preview.registrationField = await metrics('[data-design="a"] input');
  await page
    .locator('[data-design="a"] .sto-phone')
    .screenshot({ path: path.join(out, 'preview-a-registration.png') });
  fs.writeFileSync(
    path.join(out, 'comparison.json'),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
