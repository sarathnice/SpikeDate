import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

async function signIn(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
  await page.reload();
  await page.getByRole('button', { name: /Fill selected test login/i }).click();
  await page.getByRole('button', { name: 'Sign in to SpikeDate' }).click();
  await expect(page.locator('.phone-frame')).toBeVisible();
  const dismiss = page.getByRole('button', { name: /^Dismiss /i });
  if (
    await dismiss
      .first()
      .isVisible()
      .catch(() => false)
  )
    await dismiss.first().click();
  const later = page.getByRole('button', { name: 'Later', exact: true });
  if (await later.isVisible().catch(() => false)) await later.click();
}

async function expectImagesLoaded(page: Page) {
  await expect
    .poll(() =>
      page
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
}

async function seedLocalMutualMatch(page: Page) {
  await page.evaluate(() => {
    const current = localStorage.getItem('pulse-session');
    if (!current?.startsWith('test')) return;
    const other =
      current === 'test002@spikedate.test'
        ? 'test003@spikedate.test'
        : 'test002@spikedate.test';
    localStorage.setItem(
      'pulse-interactions',
      JSON.stringify([
        {
          id: `ui-match-${current}-${other}`,
          fromEmail: current,
          toEmail: other,
          kind: 'like',
          target: 'Photo 1',
          note: 'UI test match',
          status: 'accepted',
          createdAt: new Date().toISOString(),
        },
      ]),
    );
  });
  await page.reload();
  await expect(page.locator('.phone-frame')).toBeVisible();
}

test('premium phone verification is clear and mobile friendly', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
  await page.reload();
  await page
    .locator('.auth-tabs button')
    .filter({ hasText: 'Create account' })
    .click();
  const authShell = page.locator('.auth-shell');
  await expect(authShell).toHaveCSS('overflow-y', 'auto');
  await expect(page.locator('.auth-phone-verification')).toBeVisible();
  await expect(page.getByLabel('Mobile number')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await page.locator('.auth-submit').scrollIntoViewIfNeeded();
  await expect(page.locator('.auth-submit')).toBeInViewport();
  const shellCanReachBottom = await authShell.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return (
      element.scrollHeight <= element.clientHeight + 1 || element.scrollTop > 0
    );
  });
  expect(shellCanReachBottom).toBe(true);
  await page
    .getByLabel('Mobile number')
    .fill(
      testInfo.project.name === 'ios-mobile'
        ? '+1 202 555 0196'
        : '+1 202 555 0197',
    );
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(
    page.getByText(/(?:Local test code|Preview code): 123456/i),
  ).toBeVisible();
  await page.getByLabel('Six-digit verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByText('Verified and kept private')).toBeVisible();
  await expect(page.getByText(/never appears on your profile/i)).toBeVisible();
});

test('discovery actions and full profile remain usable', async ({ page }) => {
  await signIn(page);
  await expectImagesLoaded(page);
  const homePortrait = page.locator('.profile-card .cinematic-photo-main');
  await expect(homePortrait).toBeVisible();
  await expect(homePortrait).toHaveCSS('object-fit', 'cover');
  await expect(homePortrait).not.toHaveCSS('filter', 'none');
  await expect(
    page.locator('.profile-card .cinematic-photo-backdrop'),
  ).toHaveCount(0);
  await expect(
    page.locator('.profile-card .cinematic-photo-grade'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Like .*$/ }).first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Super Spike/i })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: /Send .* a Spike introduction/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Save .* privately/ }),
  ).toBeVisible();

  await page.getByRole('button', { name: /Open .* full profile/ }).click();
  const dialog = page.getByRole('dialog', { name: /full profile/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.cinematic-photo-main')).toBeVisible();
  await expect(dialog.locator('.cinematic-photo-main')).toHaveCSS(
    'object-fit',
    'cover',
  );
  const fullProfileMedia = await dialog.locator('.profile-film').boundingBox();
  expect(fullProfileMedia?.height ?? 0).toBeGreaterThan(480);
  await expect(
    dialog.getByRole('button', { name: /Send a Spike introduction/ }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Save privately' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Lift my profile' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: /Share .* profile/i }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Report' }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', { name: 'Report' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Block' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Like' })).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: /Super Spike/i }),
  ).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Like' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('dialog', { name: /^Like /i })).toHaveCount(0);
});

test('Like advances immediately while Spike has one top-placement send action', async ({
  page,
}) => {
  await signIn(page);
  const likeButton = page
    .getByRole('button', { name: /^Like [A-Za-z]/ })
    .first();
  const firstLikeLabel = await likeButton.getAttribute('aria-label');
  await likeButton.click();
  await expect(page.getByRole('dialog', { name: /^Like /i })).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .getByRole('button', { name: /^Like [A-Za-z]/ })
        .first()
        .getAttribute('aria-label'),
    )
    .not.toBe(firstLikeLabel);

  const firstSpikeLabel = await page
    .getByRole('button', { name: /^Like [A-Za-z]/ })
    .first()
    .getAttribute('aria-label');
  await page
    .getByRole('button', { name: /Send .* a Spike introduction/ })
    .click();
  const dialog = page.getByRole('dialog', { name: /^Spike /i });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: /Send Spike/i }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: /Prioritize this Spike/i }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: /Spike without a note/i }),
  ).toHaveCount(0);
  await expect(dialog).toContainText(/delivered at the top of Likes/i);
  await dialog.getByRole('button', { name: /Send Spike/i }).click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole('button', { name: /^Like [A-Za-z]/ })
        .first()
        .getAttribute('aria-label'),
    )
    .not.toBe(firstSpikeLabel);
});

test('Galaxy, Likes, Chat, and Profile navigation expose primary actions', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Lift my profile' }),
  ).toBeVisible();
  await expect(page.getByText('Start with a plan')).toBeVisible();
  await expect(page.getByText('Browse the Galaxy')).toBeVisible();

  await page.getByRole('button', { name: /^Likes/ }).click();
  await expect(
    page.getByRole('button', { name: 'Lift my profile' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Likes' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Liked you/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /You liked/ })).toBeVisible();
  await page.getByRole('tab', { name: /Matches/ }).click();
  await expect(page.locator('.matches-list')).toBeVisible();

  await page.getByRole('button', { name: /^Chat/ }).click();
  await expect(
    page.getByRole('button', { name: 'Lift my profile' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chats' })).toBeVisible();
  await expect(
    page.locator('.chat-row').first().or(page.getByText('No matches yet')),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Lift my profile' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Preview my card/i }),
  ).toBeVisible();
  await expect(page.locator('.push-settings-card')).toContainText(
    'New matches',
  );
  await expect(page.locator('.push-settings-card')).toContainText(
    'Quiet hours',
  );
  await expect(page.locator('.voice-settings-card')).toContainText(
    'Daily announcements',
  );
  await expect(page.getByRole('button', { name: /Log out/i })).toBeVisible();
});

test('Today composer merges the update and private availability', async ({
  page,
}) => {
  await signIn(page);
  const homeToday = page
    .locator('.home-action-rail')
    .getByRole('button', { name: 'Post or edit your Today update' });
  await expect(homeToday).toBeVisible();
  await expect(homeToday).toHaveText('');
  await expect(homeToday.locator('svg')).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
  await homeToday.click();
  await expect(page.getByRole('dialog', { name: /your Today/i })).toBeVisible();
  await page.getByRole('button', { name: 'Close Today composer' }).click();

  await page.getByRole('button', { name: /Open .* full profile/i }).click();
  const fullProfile = page.locator('.profile-sheet');
  const fullProfileToday = fullProfile.getByRole('button', {
    name: 'Post or edit your Today update',
  });
  await expect(fullProfileToday).toBeVisible();
  await expect(fullProfileToday).toHaveText('');
  await expect(fullProfileToday.locator('svg')).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
  await fullProfileToday.click();
  await expect(fullProfile).not.toBeVisible();
  await expect(page.getByRole('dialog', { name: /your Today/i })).toBeVisible();
  await page.getByRole('button', { name: 'Close Today composer' }).click();

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page
    .locator('.profile-passport-topbar')
    .getByRole('button', { name: 'Today', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: /your Today/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Today update')).toBeVisible();
  await expect(dialog).toContainText('When are you available?');
  await expect(dialog).toContainText('shown only to mutual matches');
  await expect(dialog).toContainText(/current or home location/i);
  await dialog.getByRole('button', { name: 'Tomorrow', exact: true }).click();
  await page.getByLabel('Available from').fill('19:00');
  await page.getByLabel('Available until').fill('22:00');
  await dialog.getByRole('button', { name: 'Save Today' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(/Tomorrow · 7:00 PM–10:00 PM/i)).toBeVisible();
  await expect(page.getByText('AVAILABILITY', { exact: true })).toHaveCount(0);
});

test('private date planning requires the safety gate on mobile', async ({
  page,
}) => {
  await signIn(page);
  await seedLocalMutualMatch(page);
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  await page.getByRole('button', { name: /Plan a coffee date/i }).click();

  const planner = page.locator('.plan-dialog');
  await expect(planner).toBeVisible();
  await expect(
    planner.getByText(/current or home location stays private/i),
  ).toBeVisible();
  await planner.getByRole('button', { name: 'Browse venues' }).click();
  await expect(planner.getByText(/Public places near/i)).toBeVisible();
  await planner.locator('.venue-results > button').first().click();
  await planner.getByRole('button', { name: 'Choose a match' }).click();
  await expect(
    planner.getByText(/Only people you mutually matched/i),
  ).toBeVisible();
  await expect(
    planner.locator('.plan-match-availability').first(),
  ).toContainText(/Available|Shared|not shared/i);
  await planner.locator('.plan-match-picker > button').first().click();
  await planner.getByRole('button', { name: 'Review invitation' }).click();

  const send = planner.getByRole('button', { name: /Send private invite/i });
  await expect(send).toBeDisabled();
  await planner.locator('.plan-safety-consent input').check();
  await expect(send).toBeEnabled();
  await send.click();

  await expect(page.locator('.galaxy-upcoming-card').first()).toBeVisible();
  await expect(
    page.getByRole('button', { name: /trusted contact/i }).first(),
  ).toBeVisible();
});

test('photo safety check is accessible and fits the mobile viewport', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page
    .getByRole('button', { name: /Photo Verified|Verify your photos/i })
    .click();
  const verification = page.getByRole('dialog', {
    name: /Your photos are verified|Confirm you match your photos/i,
  });
  await expect(verification).toBeVisible();
  await expect(
    verification.getByRole('button', { name: /Close photo verification/i }),
  ).toBeVisible();
  await expect(
    verification
      .getByText(/Never adds this selfie to your profile/i)
      .or(verification.getByText(/Photo Verified badge/i)),
  ).toBeVisible();
  const bounds = await verification.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height);
});

test('Profile Lift and subscription sheets fit between safe areas', async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole('button', {
      name: /Lift my profile|View active Profile Lift/i,
    })
    .click();
  const lift = page.getByRole('dialog', {
    name: /Be seen sooner|Your Profile Lift is active/i,
  });
  await expect(lift).toBeVisible();
  await expect(
    lift
      .getByRole('button', { name: /Start .* Profile Lift/i })
      .or(lift.getByRole('button', { name: /Profile Lift is running/i })),
  ).toBeVisible();
  await expect(
    lift.getByRole('button', { name: /Close Profile Lift/i }),
  ).toBeVisible();
  await lift.getByRole('button', { name: /Close Profile Lift/i }).click();

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: /SpikeDate\+|Free plan/i }).click();
  const subscription = page.getByRole('dialog', {
    name: /More signal\. Less noise\./i,
  });
  await expect(subscription).toBeVisible();
  await expect(
    subscription.getByRole('button', { name: /Close/i }),
  ).toBeVisible();
  await expect(
    subscription
      .getByRole('button', { name: /Subscribe|Choose .* SpikeDate\+/i })
      .or(subscription.getByRole('button', { name: /SpikeDate\+ is active/i })),
  ).toBeVisible();

  const bounds = await subscription.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height);
});

test('profile photo crop, upload, display, and cleanup work on mobile', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: /Edit preferences & media/i }).click();
  const registration = page.getByRole('dialog', {
    name: 'Preferences & media',
  });
  await expect(registration).toBeVisible();
  const before = await registration.locator('.profile-media-tile').count();
  await registration
    .getByLabel('Add and crop profile photo')
    .setInputFiles(path.resolve('public/maya.png'));

  const cropper = page.getByRole('dialog', { name: 'Frame your best shot' });
  await expect(cropper).toBeVisible();
  const cropBounds = await cropper.locator('.photo-crop-stage').boundingBox();
  expect(cropBounds).not.toBeNull();
  expect(cropBounds!.width / cropBounds!.height).toBeCloseTo(0.8, 1);
  await cropper.getByLabel('Photo zoom').fill('1.18');
  await cropper.getByRole('button', { name: 'Use photo' }).click();
  await expect(cropper).toBeHidden();
  await expect(registration.locator('.profile-media-tile')).toHaveCount(
    before + 1,
  );
  await expectImagesLoaded(page);

  const lastPhoto = registration.locator('.profile-media-tile').last();
  const uploadedSource = await lastPhoto.locator('img').getAttribute('src');
  expect(uploadedSource).toMatch(/(?:\/api\/media\/|^data:image\/)/);
  const remove = lastPhoto.getByRole('button', {
    name: /Remove profile photo/i,
  });
  await remove.click();
  await expect(registration.locator('.profile-media-tile')).toHaveCount(before);
});
