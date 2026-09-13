import { defineConfig, devices } from '@playwright/test';

const channel =
  process.env.SPIKEDATE_PLAYWRIGHT_CHANNEL === 'bundled' ? undefined : 'msedge';

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 75_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'outputs/playwright-results.json' }],
  ],
  use: {
    baseURL: process.env.SPIKEDATE_UI_URL || 'http://127.0.0.1:3002',
    ...(channel ? { channel } : {}),
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'ios-mobile',
      use: {
        ...devices['iPhone 13'],
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
