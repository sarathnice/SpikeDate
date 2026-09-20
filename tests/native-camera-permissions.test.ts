import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
it('Android declares camera permission without excluding camera-less devices', () => {
  const manifest = readFileSync(
    'android/app/src/main/AndroidManifest.xml',
    'utf8',
  );
  expect(manifest).toContain(
    '<uses-permission android:name="android.permission.CAMERA" />',
  );
  expect(manifest).toContain(
    '<uses-feature android:name="android.hardware.camera.any" android:required="false" />',
  );
});
it('iOS declares an honest camera purpose exactly once and preserves microphone configuration', () => {
  const plist = readFileSync('ios/App/App/Info.plist', 'utf8');
  expect(plist.match(/<key>NSCameraUsageDescription<\/key>/g)).toHaveLength(1);
  expect(plist).toMatch(
    /<key>NSCameraUsageDescription<\/key>\s*<string>[^<]+does not upload or save your selfie\.<\/string>/,
  );
  expect(plist.match(/<key>NSMicrophoneUsageDescription<\/key>/g)).toHaveLength(
    1,
  );
});
