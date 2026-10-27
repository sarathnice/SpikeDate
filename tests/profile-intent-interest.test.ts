import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ProfileIntentInterest, primaryProfileInterest } from '@/components/profile-intent-interest';

it('uses one actual saved interest and preserves the relationship goal', () => {
  const markup = renderToStaticMarkup(createElement(ProfileIntentInterest, { intent: 'Marriage', tags: ['Music lover', 'Hiking', 'Gaming'] }));
  expect(markup).toContain('Marriage');
  expect(markup).toContain('Music lover');
  expect(markup).not.toContain('Hiking');
  expect(markup).not.toContain('Gaming');
  expect(markup).toContain('lucide-music');
});
it('does not invent interests, shared interests, availability or verification', () => {
  const markup = renderToStaticMarkup(createElement(ProfileIntentInterest, { intent: 'Dating', tags: [] }));
  expect(markup).not.toContain('profile-primary-interest');
  expect(markup).not.toMatch(/Free tonight|Verified|Shared interest/);
});
it('skips empty, duplicated intent and oversized interests', () => {
  expect(primaryProfileInterest([' ', ' dating ', 'x'.repeat(41), ' Coffee '], 'Dating')).toBe('Coffee');
  expect(primaryProfileInterest(['Dating'], 'Dating')).toBeNull();
});
it('renders saved text safely and uses a neutral icon for other interests', () => {
  const markup = renderToStaticMarkup(createElement(ProfileIntentInterest, { intent: 'Dating', tags: ['<script>alert(1)</script>'] }));
  expect(markup).not.toContain('<script>');
  expect(markup).toContain('&lt;script&gt;');
  expect(markup).toContain('lucide-sparkles');
});

it('keeps both details visible and inside the cinematic card at mobile widths', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const markup = renderToStaticMarkup(createElement(ProfileIntentInterest, { intent: 'Long-term relationship', tags: ['Music lover'] }));
    const styles = ['app/quiet-rail.css', 'app/profile-intent-interest.css'].map((path) => readFileSync(path, 'utf8')).join('\n');
    for (const width of [320, 393, 430]) {
      await page.setViewportSize({ width, height: 852 });
      await page.setContent(`<style>body{margin:0;background:#090b12}.card-content{width:calc(100% - 94px);margin:24px 20px}${styles}</style><div class="phone-frame"><div class="quiet-rail-home"><div class="profile-card"><div class="card-content">${markup}</div></div></div></div>`);
      const details = await page.locator('.profile-intent-interest > span').evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { display: getComputedStyle(node).display, width: box.width, right: box.right, left: box.left };
      }));
      expect(details).toHaveLength(2);
      for (const detail of details) {
        // Flex items are blockified by the browser's computed display value.
        expect(['flex', 'inline-flex']).toContain(detail.display);
        expect(detail.width).toBeGreaterThan(0);
        expect(detail.left).toBeGreaterThanOrEqual(0);
        expect(detail.right).toBeLessThanOrEqual(width - 60);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  } finally {
    await browser.close();
  }
}, 120_000);
