import { test, expect } from '@playwright/test';
import { installSyntheticCamera, setCameraMode } from '../qa/camera-fixture';
import path from 'node:path';
import { readdirSync } from 'node:fs';

function registrationPhoto() {
  const directory = process.env.SPIKEDATE_QA_REGISTRATION_IMAGE_DIR;
  if (!directory) return path.resolve('public/maya.png');
  const photos = readdirSync(directory)
    .filter((name) => /\.(?:jpe?g|png|webp|heic|heif)$/i.test(name))
    .sort()
    .map((name) => path.join(directory, name));
  if (!photos.length)
    throw new Error(`No registration photos found in ${directory}`);
  return photos[
    test.info().project.name === 'android-mobile' && photos.length > 1 ? 1 : 0
  ];
}

test('signup validation, real identity, profile completion and database persistence', async ({
  page,
}) => {
  test.skip(
    !/localhost|127\.0\.0\.1/.test(test.info().project.use.baseURL || ''),
    'Synthetic registration writes are local only.',
  );
  await installSyntheticCamera(page);
  await page.goto('/');
  await page.getByRole('tab', { name: 'Create account' }).click();
  const email = `signup-${test.info().project.name}-${Date.now()}@spikedate.test`;
  await expect(page.getByLabel('Email', { exact: true })).toBeHidden();
  await page
    .getByLabel('Mobile number', { exact: true })
    .fill(`+1202555${String(Date.now()).slice(-4)}`);
  await page.getByRole('button', { name: /Send code/ }).click();
  const message = page.locator('.auth-phone-message');
  await expect(message).toContainText(/(?:Local test|Preview) code/);
  const code = (await message.innerText()).match(/\d{6}/)![0];
  await page.getByLabel('Six-digit verification code').fill(code);
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.locator('.auth-phone-success')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Abcdefghi12');
  const create = page.getByRole('button', {
    name: 'Create account',
    exact: true,
  });
  await create.click();
  await expect(page.getByRole('alert')).toContainText('12–128');
  await page.getByLabel('Password', { exact: true }).fill('SpikeDate2026!');
  await page.getByLabel('Birthday').fill('2015-01-01');
  await create.click();
  await expect(page.getByRole('alert')).toContainText('at least 18');
  await page.getByLabel('Birthday').fill('1997-05-12');
  await page.getByLabel('Gender', { exact: true }).selectOption('Woman');
  await create.click();
  await expect(page.getByRole('alert')).toContainText('Accept the terms');
  await page.getByRole('checkbox', { name: /I am 18 or older/ }).check();
  await create.scrollIntoViewIfNeeded();
  await expect(create).toBeInViewport();
  await create.click();
  const dialog = page.locator('.registration-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Birthday')).toHaveValue('1997-05-12');
  await expect(dialog.getByLabel('First name')).toHaveValue('');
  await dialog.getByLabel('First name').fill('Signup QA');
  await dialog.getByLabel('City', { exact: true }).fill('Brooklyn');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.getByRole('button', { name: 'Long-term', exact: true }).click();
  await dialog.getByText('How we connect · Optional', { exact: true }).click();
  await dialog
    .getByLabel('Relationship style', { exact: true })
    .selectOption('Monogamy');
  for (const value of ['Kindness', 'Honesty', 'Family'])
    await dialog.getByRole('button', { name: value, exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Curiosity', exact: true }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: 'Woman', exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'Add one clear profile photo',
  );
  await dialog
    .getByLabel('Add and crop profile photo')
    .setInputFiles(registrationPhoto());
  const editor = page.getByRole('dialog', { name: 'Review your photo' });
  await editor.getByRole('button', { name: 'Save photo' }).click();
  await expect(editor).toBeHidden({ timeout: 30000 });
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog
    .getByRole('button', {
      name: 'Coffee and an easy conversation.',
      exact: true,
    })
    .click();
  expect(
    await dialog.locator('[data-slot="dialog-title"]').evaluate((el) => ({
      size: getComputedStyle(el).fontSize,
      weight: getComputedStyle(el).fontWeight,
    })),
  ).toEqual({ size: '21px', weight: '500' });
  expect(
    await dialog.getByLabel('First prompt').evaluate((el) => ({
      size: getComputedStyle(el).fontSize,
      weight: getComputedStyle(el).fontWeight,
    })),
  ).toEqual({ size: '16px', weight: '400' });
  await dialog
    .getByText('Life & lifestyle · Optional', { exact: true })
    .click();
  const dropdownAudit = await dialog.locator('select').evaluateAll((selects) =>
    selects.map((select) => {
      const element = select as HTMLSelectElement;
      const controlStyle = getComputedStyle(element);
      const optionStyle = getComputedStyle(element.options[0]);
      return {
        label: element.getAttribute('aria-label'),
        height: element.getBoundingClientRect().height,
        colorScheme: controlStyle.colorScheme,
        optionColor: optionStyle.color,
        optionBackground: optionStyle.backgroundColor,
      };
    }),
  );
  for (const dropdown of dropdownAudit) {
    expect(dropdown.height, `${dropdown.label} touch height`).toBeGreaterThanOrEqual(48);
    expect(dropdown.colorScheme, `${dropdown.label} color scheme`).toBe('dark');
    expect(dropdown.optionColor, `${dropdown.label} option text`).toBe(
      'rgb(255, 255, 255)',
    );
    expect(dropdown.optionBackground, `${dropdown.label} option surface`).toBe(
      'rgb(17, 20, 29)',
    );
  }
  expect(
    await dialog.locator('.registration-body').evaluate((element) =>
      getComputedStyle(element, '::-webkit-scrollbar').width,
    ),
  ).toBe('5px');
  await dialog
    .getByLabel('Education', { exact: true })
    .selectOption('Master’s degree');
  await dialog
    .getByLabel('Have children?', { exact: true })
    .selectOption('Has kids');
  await dialog
    .getByLabel('Want children?', { exact: true })
    .selectOption('Open to children');
  await dialog.getByLabel('Drinking', { exact: true }).selectOption('Socially');
  await dialog.getByLabel('Smoking', { exact: true }).selectOption('No');
  await dialog
    .getByText('Your personality · Optional', { exact: true })
    .click();
  await dialog
    .getByLabel('About me', { exact: true })
    .fill('Coffee, kind people, and weekend adventures.');
  await dialog
    .getByRole('button', { name: 'Indie music', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Road trips', exact: true }).click();
  await dialog
    .getByLabel('Second conversation starter')
    .selectOption('My Sunday vibe is…');
  await dialog
    .getByRole('button', { name: 'A hike and a great lunch.', exact: true })
    .click();
  await expect(dialog.getByLabel('First prompt')).toHaveValue(
    'Coffee and an easy conversation.',
  );
  await dialog.getByRole('button', { name: 'Close registration' }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await expect(dialog.getByLabel('First prompt')).toHaveValue(
    'Coffee and an easy conversation.',
  );
  await expect(dialog.locator('.flow-kicker')).toContainText('4 OF 5');
  await expect(
    dialog.getByRole('button', { name: 'Continue', exact: true }),
  ).toBeInViewport();
  await dialog
    .getByRole('button', { name: 'Do this later', exact: true })
    .click();
  await expect(dialog.locator('.vibe-profile-review')).not.toContainText(
    'Coffee and an easy conversation.',
  );
  await dialog.getByRole('button', { name: 'Edit vibe', exact: true }).click();
  await dialog
    .getByRole('button', {
      name: 'Coffee and an easy conversation.',
      exact: true,
    })
    .click();
  await page.screenshot({
    path: `outputs/vibe-registration-${test.info().project.name}.png`,
  });
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.locator('.vibe-profile-review')).toContainText(
    'Coffee and an easy conversation.',
  );
  if (!process.env.SPIKEDATE_QA_REGISTRATION_IMAGE_DIR) {
    let failSaveOnce = true;
    await page.route('**/api/profile', async (route) => {
      if (
        route.request().method() === 'PATCH' &&
        failSaveOnce &&
        route.request().postDataJSON().section === 'prompts'
      ) {
        failSaveOnce = false;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Synthetic save failure' }),
        });
      } else await route.continue();
    });
    await dialog
      .getByRole('button', { name: 'Save profile', exact: true })
      .click();
    await expect(dialog.getByRole('alert')).toContainText('Could not save');
    await expect(dialog).toBeVisible();
    await expect(page.locator('.verification-dialog')).not.toBeVisible();
  }
  await dialog
    .getByRole('button', { name: 'Save profile', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const camera = page.locator('.verification-dialog');
  await expect(
    camera.getByRole('heading', { name: 'Verify your photos' }),
  ).toBeVisible();
  const startCamera = camera.getByRole('button', {
    name: 'Start secure check',
  });
  await expect(startCamera).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __cameraQA: { calls: number } }).__cameraQA
          .calls,
    ),
  ).toBe(0);
  await camera.getByRole('checkbox').check();
  await setCameraMode(page, 'denied');
  await startCamera.click();
  await expect(camera.getByRole('alert')).toContainText(
    'permission was denied',
  );
  await setCameraMode(page, 'blank');
  await startCamera.click();
  const capture = camera.getByRole('button', { name: 'Capture and check' });
  await expect(capture).toBeVisible();
  await expect
    .poll(() =>
      camera
        .locator('video')
        .evaluate((video) => (video as HTMLVideoElement).readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await capture.click();
  await expect(camera.getByRole('status')).toContainText('Keep one face', {
    timeout: 30000,
  });
  await setCameraMode(page, 'multiple');
  // Wait for the next synthetic video frame, not a mocked detector response.
  await page.waitForTimeout(300);
  await capture.click();
  await expect(camera.getByRole('status')).toContainText('Only one person');
  await setCameraMode(page, 'face');
  await page.waitForTimeout(300);
  await capture.click();
  await expect(
    camera.getByRole('heading', { name: 'Is your face clear and centered?' }),
  ).toBeVisible();
  await expect(camera.getByRole('button', { name: 'Save camera check' })).toBeInViewport();
  await camera.getByRole('button', { name: 'Save camera check' }).click();
  await expect(
    camera.getByRole('heading', { name: 'Camera check complete' }),
  ).toBeVisible();
  await expect(
    camera.getByText(/does not issue a verified badge/),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = (
          window as unknown as { __cameraQA: { streams: MediaStream[] } }
        ).__cameraQA;
        return state.streams
          .flatMap((stream) => stream.getTracks())
          .every((track) => track.readyState === 'ended');
      }),
    )
    .toBe(true);
  expect(
    await page.evaluate(() =>
      (
        window as unknown as {
          __cameraQA: { constraints: MediaStreamConstraints[] };
        }
      ).__cameraQA.constraints.every((item) => item.audio === false),
    ),
  ).toBe(true);
  const cameraBounds = await camera.boundingBox();
  expect(cameraBounds!.x).toBeGreaterThanOrEqual(0);
  expect(cameraBounds!.y).toBeGreaterThanOrEqual(0);
  expect(cameraBounds!.y + cameraBounds!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await camera.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(camera).toBeHidden();
  const hasServerSession = (await page.context().cookies()).some(
    (cookie) => cookie.name === 'spikedate_session' && cookie.value.length > 0,
  );
  if (!hasServerSession) {
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Preview my profile card' }).click();
    await expect(page.locator('.preview-screen .card-story')).toHaveText(
      'Coffee and an easy conversation.',
    );
    await page
      .getByRole('button', { name: 'Open your full profile preview' })
      .click();
    const localFull = page.locator('.profile-preview-sheet');
    await expect(localFull).toContainText('Master’s degree');
    await expect(localFull).toContainText('Has kids');
    await expect(localFull).toContainText('A hike and a great lunch.');
    await expect(localFull.locator('.cinematic-photo-main')).toHaveAttribute(
      'src',
      /^(?:blob:|data:image\/)/,
    );
    return;
  }
  await expect
    .poll(async () => {
      const account = await page.evaluate(async () => {
        const response = await fetch('/api/profile');
        return response.json();
      });
      return {
        birthday: account.birthDate,
        gender: account.profile.gender,
        name: account.profile.display_name,
      };
    })
    .toEqual({
      birthday: '1997-05-12',
      gender: 'Woman',
      name: 'Signup QA',
    });
  const rejected = await page.request.patch('/api/profile', {
    data: { section: 'profile', data: { birthDate: '2015-01-01' } },
  });
  expect(rejected.status()).toBe(400);
  await page.reload();
  const persisted = await (await page.request.get('/api/profile')).json();
  expect(persisted.birthDate).toBe('1997-05-12');
  expect(persisted.profile.gender).toBe('Woman');
  expect(persisted.profile.education).toBe('Master’s degree');
  expect(persisted.profile.kids).toBe('Has kids');
  expect(persisted.profile.wants_kids).toBe('Open to children');
  expect(persisted.profile.drinking).toBe('Socially');
  expect(persisted.profile.smoking).toBe('No');
  expect(persisted.profile.bio).toBe(
    'Coffee, kind people, and weekend adventures.',
  );
  expect(
    persisted.interests.map((item: { label: string }) => item.label),
  ).toEqual(expect.arrayContaining(['Indie music', 'Road trips']));
  expect(persisted.prompts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        prompt: 'My Sunday vibe is…',
        answer: 'A hike and a great lunch.',
      }),
    ]),
  );
  expect(persisted.prompts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        prompt: 'Our first date starts with…',
        answer: 'Coffee and an easy conversation.',
      }),
    ]),
  );
  expect(persisted.profile.verification_status).toBe('capture_ready');
  expect(persisted.profile.discoverable).toBe(0);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Preview my profile card' }).click();
  await expect(page.locator('.preview-screen .card-story')).toHaveText(
    'Coffee and an easy conversation.',
  );
  await page
    .getByRole('button', { name: 'Open your full profile preview' })
    .click();
  const full = page.locator('.profile-preview-sheet');
  const starter = full.locator('section').filter({
    has: page.locator('.section-label', {
      hasText: 'Our first date starts with…',
    }),
  });
  await expect(starter).toContainText('Coffee and an easy conversation.');
  await expect(full).toContainText('Master’s degree');
  await expect(full).toContainText('Has kids');
  await expect(full).toContainText('A hike and a great lunch.');
  await expect(full.locator('.cinematic-photo-main')).toHaveAttribute(
    'src',
    /\/api\/media\//,
  );
  await full.getByRole('button', { name: 'Close full profile' }).click();
});

test('server rejects missing consent, short passwords and underage registration', async ({
  request,
}) => {
  const valid = {
    email: `invalid-${Date.now()}@spikedate.test`,
    password: 'SpikeDate2026!',
    birthDate: '1996-06-13',
    gender: 'Woman',
    displayName: 'Signup QA',
    relationshipGoal: 'Dating',
    termsAccepted: true,
  };
  for (const change of [
    { termsAccepted: false },
    { password: 'Abcdefghi12' },
    { birthDate: '2015-01-01' },
  ]) {
    const response = await request.post('/api/auth/register', {
      data: { ...valid, ...change },
    });
    expect(response.status()).toBe(400);
  }
});
