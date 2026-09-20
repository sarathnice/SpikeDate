import type { Page } from '@playwright/test';

// Synthetic camera, real MediaPipe detector. This intentionally proves a still
// portrait passes detection, NOT anti-spoof/liveness. Never use for real accounts.
export async function installSyntheticCamera(page: Page) {
  await page.addInitScript(() => {
    type Mode = 'face' | 'blank' | 'multiple' | 'dark' | 'denied' | 'delayed';
    const state = {
      mode: 'face' as Mode,
      calls: 0,
      streams: [] as MediaStream[],
      constraints: [] as MediaStreamConstraints[],
    };
    Object.assign(window, { __cameraQA: state });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async (constraints: MediaStreamConstraints) => {
        state.calls++;
        state.constraints.push(constraints);
        if (state.mode === 'denied')
          throw new DOMException('Test permission denial', 'NotAllowedError');
        if (state.mode === 'delayed')
          await new Promise((resolve) => setTimeout(resolve, 800));
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 480;
        const ctx = canvas.getContext('2d')!;
        const image = new Image();
        image.src = '/maya.png';
        await image.decode();
        const render = () => {
          ctx.fillStyle = state.mode === 'dark' ? '#000' : '#999';
          ctx.fillRect(0, 0, 480, 480);
          if (state.mode === 'face' || state.mode === 'delayed')
            ctx.drawImage(image, 350, 220, 650, 650, 0, 0, 480, 480);
          if (state.mode === 'multiple') {
            ctx.drawImage(image, 440, 260, 450, 500, 0, 90, 230, 280);
            ctx.drawImage(image, 440, 260, 450, 500, 250, 90, 230, 280);
          }
        };
        render();
        const stream = canvas.captureStream(10);
        state.streams.push(stream);
        const timer = setInterval(() => {
          if (stream.getTracks().every((track) => track.readyState === 'ended'))
            clearInterval(timer);
          else render();
        }, 100);
        return stream;
      },
    });
  });
}

export async function setCameraMode(page: Page, mode: string) {
  await page.evaluate((mode) => {
    (window as unknown as { __cameraQA: { mode: string } }).__cameraQA.mode =
      mode;
  }, mode);
}
