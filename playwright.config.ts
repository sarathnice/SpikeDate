import { defineConfig, devices } from '@playwright/test';

const channel =
  process.env.SPIKEDATE_PLAYWRIGHT_CHANNEL === 'bundled' ? undefined : 'msedge';

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 75_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.SPIKEDATE_QA_RETRIES === '1' ? 1 : 0,
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile: process.env.SPIKEDATE_QA_REPORT_DIR
          ? `${process.env.SPIKEDATE_QA_REPORT_DIR}/playwright.json`
          : 'outputs/playwright-results.json',
      },
    ],
    [
      'html',
      {
        outputFolder: process.env.SPIKEDATE_QA_REPORT_DIR
          ? `${process.env.SPIKEDATE_QA_REPORT_DIR}/browser-report`
          : 'playwright-report',
        open: 'never',
      },
    ],
    [
      'junit',
      {
        outputFile: process.env.SPIKEDATE_QA_REPORT_DIR
          ? `${process.env.SPIKEDATE_QA_REPORT_DIR}/junit.xml`
          : 'outputs/playwright-junit.xml',
      },
    ],
  ],
  outputDir: process.env.SPIKEDATE_QA_REPORT_DIR
    ? `${process.env.SPIKEDATE_QA_REPORT_DIR}/artifacts`
    : 'test-results',
  use: {
    baseURL: process.env.SPIKEDATE_UI_URL || 'http://127.0.0.1:3002',
    ...(process.env.SPIKEDATE_SITES_BYPASS_TOKEN
      ? {
          extraHTTPHeaders: {
            'OAI-Sites-Authorization': `Bearer ${process.env.SPIKEDATE_SITES_BYPASS_TOKEN}`,
          },
        }
      : {}),
    ...(channel ? { channel } : {}),
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'ios-mobile',
      use: {
        ...devices['iPhone 15'],
        browserName: 'chromium',
      },
    },
    {
      name: 'android-mobile',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
      },
    },
  ],
});
