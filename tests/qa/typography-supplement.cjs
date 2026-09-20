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
(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const result = { conversations: [], admin: null, screenshots: [] };
  async function login(page, number) {
    await page.goto(base);
    await page
      .getByLabel('Test profile')
      .selectOption(`test${String(number).padStart(3, '0')}@spikedate.test`);
    await page
      .getByRole('button', { name: /Fill selected test login/ })
      .click();
    await page.getByRole('button', { name: 'Sign in to SpikeDate' }).click();
    await page.getByRole('button', { name: 'Profile', exact: true }).waitFor();
    for (const name of [/^Dismiss /, /^Later$/, /^Maybe later$/]) {
      const button = page.getByRole('button', { name }).first();
      if (await button.isVisible().catch(() => false)) await button.click();
    }
    await page.waitForTimeout(600);
  }
  async function text(root) {
    return root.evaluate((el) =>
      [
        ...el.querySelectorAll(
          'h1,h2,h3,p,strong,b,small,span,button,input,textarea,.bubble,.day-label',
        ),
      ].flatMap((node) => {
        const direct = [...node.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join(' ')
          .trim();
        const style = getComputedStyle(node);
        if (
          !node.getClientRects().length ||
          (!direct && !['INPUT', 'TEXTAREA'].includes(node.tagName)) ||
          node.closest('.sr-only') ||
          parseFloat(style.fontSize) === 0
        )
          return [];
        return [
          {
            text: (
              direct ||
              node.getAttribute('placeholder') ||
              node.tagName
            ).slice(0, 80),
            size: parseFloat(style.fontSize),
            weight: style.fontWeight,
            font: style.fontFamily,
            style: style.fontStyle,
          },
        ];
      }),
    );
  }
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [1440, 900],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await login(page, 42);
    await page
      .getByRole('button', { name: /Open .* full profile/ })
      .first()
      .waitFor();
    await page
      .locator('.cinematic-photo-main')
      .first()
      .evaluate(
        (img) =>
          img.complete ||
          new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
            setTimeout(resolve, 8000);
          }),
      );
    const photo = await page
      .locator('.cinematic-photo-main')
      .first()
      .evaluate((img) => ({
        loaded: img.naturalWidth > 0,
        width: img.naturalWidth,
      }));
    await page.screenshot({
      path: path.join(out, `${width}x${height}-home.png`),
    });
    result.screenshots.push({
      viewport: `${width}x${height}`,
      screen: 'Home',
      photo,
    });
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Preview my profile card' }).click();
    await page
      .getByRole('button', { name: 'Open your full profile preview' })
      .click();
    await page.waitForTimeout(700);
    await page.screenshot({
      path: path.join(out, `${width}x${height}-full-profile.png`),
    });
    if (width === 390) {
      await page.goto(`${base}/admin`);
      await page.waitForTimeout(1200);
      result.admin = {
        text: await text(page.locator('.admin-shell')),
        note: 'Only the accessible admin overview/state was inspected; no moderation actions performed.',
      };
    }
    await context.close();
  }
  for (let number = 1; number <= 8; number++) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await login(page, number);
    await page.getByRole('button', { name: /^Chat/ }).click();
    await page.waitForTimeout(600);
    const open = page.locator('.chat-conversation').first();
    console.log(`Account ${number}: conversations ${await open.count()}`);
    if (await open.isVisible()) {
      await open.click();
      await page.waitForTimeout(500);
      for (const [width, height] of [
        [320, 740],
        [360, 640],
        [390, 844],
        [412, 915],
        [768, 1024],
        [1024, 768],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height });
        result.conversations.push({
          viewport: `${width}x${height}`,
          account: number,
          text: await text(page.locator('.thread')),
        });
      }
      await page.screenshot({ path: path.join(out, 'chat-conversation.png') });
      await context.close();
      break;
    }
    await context.close();
  }
  if (process.env.SPIKEDATE_EXPECT_QUIET_PRECISION === 'true') {
    result.conversationChecks = result.conversations.map((conversation) => ({
      viewport: conversation.viewport,
      passed: conversation.text.every(
        (t) =>
          t.font.includes('Inter') &&
          ['400', '500'].includes(t.weight) &&
          t.style === 'normal' &&
          t.size >= 11,
      ),
    }));
    if (result.conversationChecks.some((check) => !check.passed))
      process.exitCode = 1;
  }
  fs.writeFileSync(
    path.join(out, 'supplement.json'),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
