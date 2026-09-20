import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installSyntheticCamera, setCameraMode } from '../qa/camera-fixture';

test.skip(
  ({ baseURL }) =>
    !baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname),
  'Camera QA creates only local synthetic accounts.',
);

async function prepareAccount(page: Page) {
  await installSyntheticCamera(page);
  const reuse = process.env.SPIKEDATE_CAMERA_QA_REUSE_EMAIL;
  const email =
    reuse || `camera-${test.info().project.name}-${Date.now()}@spikedate.test`;
  if (reuse) {
    // Retest only an explicitly named account created by this local QA suite.
    expect(reuse).toMatch(/^camera-[\w-]+@spikedate\.test$/);
    const login = await page.request.post('/api/auth/login', {
      data: { email, password: 'SpikeDate2026!' },
    });
    expect(login.ok()).toBe(true);
    expect((await page.request.delete('/api/verification')).ok()).toBe(true);
  } else {
    const phone = `+1202555${String(Date.now()).slice(-4)}`;
    const start = await page.request.post('/api/auth/phone/start', {
      data: { phoneNumber: phone },
    });
    expect(start.ok()).toBe(true);
    const challenge = await start.json();
    const verify = await page.request.post('/api/auth/phone/verify', {
      data: { challengeId: challenge.challengeId, code: challenge.testCode },
    });
    expect(verify.ok()).toBe(true);
    const proof = await verify.json();
    const registered = await page.request.post('/api/auth/register', {
      data: {
        email,
        password: 'SpikeDate2026!',
        birthDate: '1996-06-13',
        displayName: 'Camera QA',
        gender: 'Woman',
        relationshipGoal: 'Long-term',
        termsAccepted: true,
        phoneVerificationToken: proof.registrationToken,
      },
    });
    expect(registered.ok()).toBe(true);
    const saved = await page.request.patch('/api/profile', {
      data: {
        section: 'profile',
        data: { bio: 'Synthetic camera QA', discoverable: true },
      },
    });
    expect(saved.ok()).toBe(true);
    const photo = await page.request.post('/api/media', {
      headers: { 'content-type': 'image/png' },
      data: readFileSync('public/maya.png'),
    });
    expect(photo.ok()).toBe(true);
  }
  await page.goto('/');
  if (
    await page.getByRole('button', { name: 'Sign in to SpikeDate' }).isVisible()
  ) {
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('SpikeDate2026!');
    await page.getByRole('button', { name: 'Sign in to SpikeDate' }).click();
  }
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: /Verify your photos/ }).click();
  await expect(
    page
      .locator('.verification-dialog')
      .getByRole('heading', { name: 'Capture your face' }),
  ).toBeVisible();
}
async function streamsStopped(page: Page) {
  return page.evaluate(() =>
    (
      window as unknown as { __cameraQA: { streams: MediaStream[] } }
    ).__cameraQA.streams
      .flatMap((stream) => stream.getTracks())
      .every((track) => track.readyState === 'ended'),
  );
}
async function startCamera(page: Page) {
  const dialog = page.locator('.verification-dialog');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Start camera check' }).click();
  // The synthetic camera decodes a full-resolution portrait before yielding
  // its stream; a busy local image server can take longer than the default.
  await expect(dialog.locator('video')).toBeVisible({ timeout: 30000 });
  await expect
    .poll(() =>
      dialog
        .locator('video')
        .evaluate((video) => (video as HTMLVideoElement).readyState),
    )
    .toBeGreaterThanOrEqual(2);
  return dialog;
}

test('model failure is actionable, close stops camera, late permission cannot reopen the dialog', async ({
  page,
}) => {
  await prepareAccount(page);
  await page.route('**/verification/blaze_face_short_range.tflite', (route) =>
    route.abort(),
  );
  const dialog = await startCamera(page);
  await dialog.getByRole('button', { name: 'Capture and check' }).click();
  await expect(dialog.getByRole('status')).toContainText(
    'Face detection could not load',
    { timeout: 30000 },
  );
  await expect(
    dialog.getByRole('button', { name: 'Capture and check' }),
  ).toBeEnabled();
  await dialog
    .getByRole('button', { name: 'Close photo verification' })
    .click();
  await expect.poll(() => streamsStopped(page)).toBe(true);
  await expect
    .poll(
      async () =>
        (await (await page.request.get('/api/verification')).json()).status,
    )
    .toBe('unverified');
  await page.getByRole('button', { name: /Verify your photos/ }).click();
  await setCameraMode(page, 'delayed');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Start camera check' }).click();
  await dialog
    .getByRole('button', { name: 'Close photo verification' })
    .click();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (window as unknown as { __cameraQA: { streams: MediaStream[] } })
            .__cameraQA.streams.length,
      ),
    )
    .toBe(2);
  await expect.poll(() => streamsStopped(page)).toBe(true);
  await expect(dialog).not.toBeVisible();
  expect(
    (await (await page.request.get('/api/verification')).json()).status,
  ).toBe('unverified');
});

test('finish later, background pause, retry, real detector, persisted capture and withdrawal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await prepareAccount(page);
  const dialog = page.locator('.verification-dialog');
  await dialog.getByRole('button', { name: 'Finish later' }).click();
  expect(
    (await (await page.request.get('/api/verification')).json()).status,
  ).toBe('unverified');
  await page.getByRole('button', { name: /Verify your photos/ }).click();
  await startCamera(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => streamsStopped(page)).toBe(true);
  await expect
    .poll(
      async () =>
        (await (await page.request.get('/api/verification')).json()).status,
    )
    .toBe('unverified');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // A new session requires fresh consent after the cancellation status update.
  const consent = dialog.getByRole('checkbox');
  if (!(await consent.isChecked())) await consent.check();
  await dialog.getByRole('button', { name: 'Start camera check' }).click();
  await expect
    .poll(() =>
      dialog
        .locator('video')
        .evaluate((video) => (video as HTMLVideoElement).readyState),
    )
    .toBeGreaterThanOrEqual(2);
  // Global toasts must not cover the capture action inside this modal.
  await expect(page.locator('.toast.show')).not.toBeVisible();
  const captureButton = dialog.getByRole('button', { name: 'Capture and check' });
  await expect(captureButton).toBeInViewport();
  expect(await captureButton.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const front = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return front === element || element.contains(front);
  })).toBe(true);
  await page.screenshot({
    path: `outputs/qa/registration-face/examples/camera-${test.info().project.name}.png`,
  });
  await dialog.getByRole('button', { name: 'Capture and check' }).click();
  await expect(dialog.getByRole('heading', { name: 'Is your face clear and centered?' })).toBeVisible({ timeout: 30000 });
  await expect(dialog.getByRole('img', { name: 'Captured face for review' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Retake' }).click();
  await expect(dialog.locator('video')).toBeVisible();
  await expect.poll(() => dialog.locator('video').evaluate((video) => (video as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  await dialog.getByRole('button', { name: 'Capture and check' }).click();
  await expect(dialog.getByRole('img', { name: 'Captured face for review' })).toBeVisible();
  await page.screenshot({ path: `outputs/qa/registration-face/examples/review-${test.info().project.name}.png` });
  const save = dialog.getByRole('button', { name: 'Save camera check' });
  await expect(save).toBeInViewport();
  await save.click();
  await expect(
    dialog.getByRole('heading', { name: 'Camera check complete' }),
  ).toBeVisible({ timeout: 30000 });
  await expect.poll(() => streamsStopped(page)).toBe(true);
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: /Camera check complete/ }).click();
  await expect(
    dialog.getByRole('heading', { name: 'Camera check complete' }),
  ).toBeVisible();
  const account = await (await page.request.get('/api/profile')).json();
  expect(account.profile.discoverable).toBe(0);
  expect(account.readiness).toMatchObject({
    phoneVerified: true,
    profileCompleted: true,
    approvedPhoto: true,
    photoVerified: false,
    ready: false,
  });
  await dialog
    .getByRole('button', { name: 'Remove verification data' })
    .click();
  await expect(
    dialog.getByRole('heading', { name: 'Capture your face' }),
  ).toBeVisible();
  expect(
    (await (await page.request.get('/api/verification')).json()).status,
  ).toBe('unverified');
});
