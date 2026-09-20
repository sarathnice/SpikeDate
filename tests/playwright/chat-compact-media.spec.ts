import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';

test.skip(
  ({ baseURL }) =>
    !baseURL ||
    !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname) ||
    new URL(baseURL).port !== '3007',
  'Dedicated local synthetic accounts only.',
);

test('compact receipts, camera capture, private photo and voice note work between matched accounts', async ({ page, browser }, info) => {
  await page.addInitScript(() => {
    const devices = navigator.mediaDevices;
    Object.defineProperty(devices, 'getUserMedia', {
      configurable: true,
      value: async (constraints: MediaStreamConstraints) => {
        if (constraints.video) {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const context = canvas.getContext('2d');
          if (context) {
            context.fillStyle = '#9a6f7b';
            context.fillRect(0, 0, 640, 480);
            context.fillStyle = '#e9d5c1';
            context.fillRect(90, 70, 460, 310);
          }
          return canvas.captureStream(15);
        }
        const context = new AudioContext();
        await context.resume();
        const tone = context.createOscillator();
        tone.frequency.value = 440;
        const destination = context.createMediaStreamDestination();
        tone.connect(destination);
        tone.start();
        return destination.stream;
      },
    });
  });
  await loginSynthetic(page, 2);
  const recipientContext = await browser.newContext();
  const recipient = await recipientContext.newPage();
  try {
    await loginSynthetic(recipient, 1);
    await page.getByRole('button', { name: /^Chat/ }).click();
    await page.getByRole('button', { name: 'Chat with Maya', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open camera or choose a photo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record a voice message' })).toBeVisible();
    const chat = (await (await page.request.get('/api/conversations')).json()).conversations.find(
      (entry: { display_name: string }) => entry.display_name === 'Maya',
    );
    expect(chat.id).toBeTruthy();

    const text = `Compact marks QA ${Date.now()}`;
    await page.getByRole('textbox', { name: 'Message Maya' }).fill(text);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('.message-status')).toContainText('Sent');
    const history = async () => (await (await page.request.get(`/api/conversations/${chat.id}/messages`)).json()).messages as Array<{ id: string; body: string; delivered_at: number | null; read_at: number | null; media_kind: string | null }>;
    const sent = (await history()).find((entry) => entry.body === text);
    expect(sent?.id).toBeTruthy();
    expect(sent?.delivered_at).toBeNull();
    const acknowledged = await recipient.request.patch(`/api/conversations/${chat.id}/messages`, { data: { deliveredIds: [sent?.id] } });
    expect(acknowledged.ok()).toBe(true);
    await expect(page.locator('.message-status')).toContainText('Delivered', { timeout: 12_000 });
    await recipient.getByRole('button', { name: /^Chat/ }).click();
    await recipient.getByRole('button', { name: 'Chat with Noah', exact: true }).click();
    await expect(recipient.locator('.thread')).toHaveAttribute('aria-busy', 'false');
    await expect(recipient.locator(`[data-message-id="${sent?.id}"]`)).toBeAttached();

    await page.getByRole('button', { name: 'Open camera or choose a photo' }).click();
    await page.getByRole('button', { name: 'Open camera', exact: true }).click();
    await expect(page.locator('.chat-camera-preview')).toBeVisible();
    await expect.poll(async () => page.locator('.chat-camera-preview').evaluate((video: HTMLVideoElement) => video.videoWidth)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Capture photo' }).click();
    await expect(page.getByRole('img', { name: 'Your selection' })).toBeVisible();
    await page.getByRole('button', { name: 'Send photo' }).click();
    await expect(page.getByRole('button', { name: 'View your photo' }).last()).toBeVisible();
    const photo = (await history()).findLast((entry) => entry.media_kind === 'photo');
    expect(photo?.id).toBeTruthy();
    const photoResponse = await recipient.request.get(`/api/chat-media/${photo?.id}`);
    expect(photoResponse.ok()).toBe(true);
    expect(photoResponse.headers()['content-type']).toBe('image/jpeg');

    await page.getByRole('button', { name: 'Open camera or choose a photo' }).click();
    await page.locator('.chat-media-file-input').setInputFiles('public/maya.png');
    await expect(page.getByRole('img', { name: 'Your selection' })).toBeVisible();
    await page.getByRole('button', { name: 'Send photo' }).click();
    await expect(page.getByRole('button', { name: 'View your photo' }).last()).toBeVisible();

    await page.getByRole('button', { name: 'Record a voice message' }).click();
    await expect(page.getByRole('dialog', { name: 'Voice message' })).toBeVisible();
    await page.waitForTimeout(1100);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Send voice note' })).toBeVisible();
    await page.getByRole('button', { name: 'Send voice note' }).click();
    await expect(page.locator('.chat-voice-bubble audio').last()).toBeVisible();
    await expect.poll(async () => page.locator('.chat-voice-bubble audio').last().evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(160);
    const voice = (await history()).findLast((entry) => entry.media_kind === 'voice');
    expect(voice?.id).toBeTruthy();
    const voiceResponse = await recipient.request.get(`/api/chat-media/${voice?.id}`);
    expect(voiceResponse.ok()).toBe(true);
    expect(voiceResponse.headers()['content-type']).toMatch(/^audio\/(webm|mp4)$/);

    const unrelatedContext = await browser.newContext();
    try {
      const unrelated = await unrelatedContext.newPage();
      await loginSynthetic(unrelated, 4);
      expect((await unrelated.request.get(`/api/chat-media/${photo?.id}`)).status()).toBe(404);
      expect((await unrelated.request.get(`/api/chat-media/${voice?.id}`)).status()).toBe(404);
    } finally {
      await unrelatedContext.close();
    }
    await page.screenshot({ path: `outputs/chat-compact-${info.project.name}.png` });
  } finally {
    await recipientContext.close();
  }
});
