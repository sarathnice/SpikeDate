import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = 'outputs/qa/gallery-glass-preview';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
let checks = 0;
try {
  for (const width of [360, 390, 412, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 1440 ? 1100 : 1000 },
    });
    await page.goto('http://localhost:3005/design/gallery-glass');
    await page.locator('.gg-preview[data-ready="true"]').waitFor();
    await page.locator('.gg-cover').evaluate(async (img) => {
      if (!img.complete)
        await new Promise((resolve) =>
          img.addEventListener('load', resolve, { once: true }),
        );
    });
    for (const screen of [
      'Home',
      'Full profile',
      'Send Spike',
      'Boost',
      'Likes',
      'Chat',
      'My Profile',
    ]) {
      await page
        .locator('.gg-tabs')
        .getByRole('button', { name: screen, exact: true })
        .click();
      await page.waitForFunction(
        (name) =>
          [...document.querySelectorAll('.gg-tabs button')].some(
            (el) =>
              el.textContent === name &&
              el.getAttribute('aria-pressed') === 'true',
          ),
        screen,
      );
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const layout = await page.locator('.gg-phone').evaluate((el) => ({
        overflow: el.scrollWidth > el.clientWidth + 1,
        font: getComputedStyle(el).fontFamily,
      }));
      assert.equal(
        layout.overflow,
        false,
        `${width} ${screen}: horizontal overflow`,
      );
      assert.match(layout.font, /Inter/);
      checks += 2;
      if (screen === 'Full profile') {
        const role = await page.locator('.gg-content section p').first().evaluate(el => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight }));
        assert.deepEqual(role, { size: '14px', weight: '400' });
        checks += 1;
      }
      if (width === 390)
        await page.locator('.gg-phone').screenshot({
          path: `${output}/${screen.toLowerCase().replaceAll(' ', '-')}.png`,
        });
    }
    await page
      .locator('.gg-tabs')
      .getByRole('button', { name: 'Home', exact: true })
      .click();
    await page.getByRole('button', { name: 'Edit Today', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'What are you doing today?' })
      .fill('A quiet evening outdoors');
    assert.equal(
      await page.getByRole('switch').getAttribute('aria-checked'),
      'true',
    );
    await page
      .getByRole('button', { name: 'Save update', exact: true })
      .click();
    assert.match(
      await page.locator('.gg-home-details').innerText(),
      /A quiet evening outdoors/,
    );
    await page.getByRole('button', { name: 'Dismiss notice' }).click();
    await page.getByRole('button', { name: 'Fresh 3', exact: true }).click();
    assert.equal(
      await page.getByRole('dialog', { name: 'Fresh updates' }).count(),
      1,
    );
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.getByRole('button', { name: 'Like', exact: true }).click();
    assert.match(await page.getByRole('status').innerText(), /next profile/);
    await page.getByRole('button', { name: 'Dismiss notice' }).click();
    await page
      .getByRole('button', { name: 'Save profile', exact: true })
      .click();
    assert.equal(
      await page.getByRole('button', { name: 'Unsave profile' }).count(),
      1,
    );
    await page
      .locator('.gg-tabs')
      .getByRole('button', { name: 'Send Spike', exact: true })
      .click();
    const note = page.locator('textarea');
    assert.equal(await note.getAttribute('maxlength'), '140');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await page.locator('.gg-home').count(), 1);
    await page
      .locator('.gg-tabs')
      .getByRole('button', { name: 'Boost', exact: true })
      .click();
    await page.getByRole('button', { name: 'Use a boost' }).click();
    assert.equal(
      await page
        .getByRole('button', { name: 'Boost active · demo' })
        .isDisabled(),
      true,
    );
    await page
      .locator('.gg-tabs')
      .getByRole('button', { name: 'Chat', exact: true })
      .click();
    await page
      .getByRole('textbox', { name: 'Message', exact: true })
      .fill('Sounds good!');
    await page.getByRole('button', { name: 'Send demo message' }).click();
    assert.match(
      await page.locator('.gg-messages').innerText(),
      /Sounds good!/,
    );
    checks += 9;
    await page.close();
  }
  console.log(
    `${checks} preview checks passed across four viewport widths. Seven screenshots saved to ${output}.`,
  );
} finally {
  await browser.close();
}
