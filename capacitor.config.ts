import type { CapacitorConfig } from '@capacitor/cli';

const stagingUrl =
  process.env.SPIKEDATE_STAGING_URL ??
  process.env.PULSE_STAGING_URL ??
  'http://localhost:3000';

const stagingHost = new URL(stagingUrl).hostname;

const config: CapacitorConfig = {
  appId: 'com.sarathnice.spikedate',
  appName: 'SpikeDate',
  webDir: 'mobile-public',
  server: {
    url: stagingUrl,
    cleartext: stagingUrl.startsWith('http://'),
    allowNavigation: [
      stagingHost,
      'localhost',
      '10.0.2.2',
      '*.sarathnice.chatgpt.site',
      '*.sarathnice.workers.dev',
    ],
  },
  android: {
    allowMixedContent: stagingUrl.startsWith('http://'),
    backgroundColor: '#0b0c12',
  },
  ios: {
    backgroundColor: '#0b0c12',
    contentInset: 'automatic',
  },
};

export default config;
