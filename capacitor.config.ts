import type { CapacitorConfig } from '@capacitor/cli';

const stagingUrl = process.env.PULSE_STAGING_URL ?? 'http://localhost:3000';

const config: CapacitorConfig = {
  appId: 'com.sarathnice.pulse',
  appName: 'PULSE',
  webDir: 'mobile-public',
  server: {
    url: stagingUrl,
    cleartext: stagingUrl.startsWith('http://'),
    allowNavigation: ['localhost', '10.0.2.2', '*.sarathnice.chatgpt.site'],
  },
  android: {
    allowMixedContent: stagingUrl.startsWith('http://'),
    backgroundColor: '#0e0e10',
  },
  ios: {
    backgroundColor: '#0e0e10',
    contentInset: 'automatic',
  },
};

export default config;
