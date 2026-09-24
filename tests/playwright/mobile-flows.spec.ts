import {
  expect,
  request as playwrightRequest,
  test,
  type Locator,
  type Page,
} from '@playwright/test';
import path from 'node:path';

async function signIn(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
  await page.reload();
  const title = test.info().title;
  const accountByScenario = title.startsWith('discovery')
    ? 2
    : title.startsWith('Like advances')
      ? 12
      : title.startsWith('Galaxy, Likes')
        ? 14
        : title.startsWith('Today composer')
          ? 16
          : title.startsWith('private date planning')
            ? 6
            : title.startsWith('photo safety')
              ? 18
              : title.startsWith('Profile Lift')
                ? 20
                : title.startsWith('profile photo crop')
                  ? 22
                  : 24;
  const accountNumber =
    accountByScenario + (test.info().project.name === 'android-mobile' ? 1 : 0);
  const account = `test${String(accountNumber).padStart(3, '0')}@spikedate.test`;
  await page.getByLabel('Test profile').selectOption(account);
  await page.getByRole('button', { name: /Fill selected test login/i }).click();
  await page.getByRole('button', { name: 'Sign in to SpikeDate' }).click();
  await expect(page.locator('.phone-frame')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Profile', exact: true }),
  ).toBeVisible();
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
  const maybeLater = page.getByRole('button', {
    name: 'Maybe later',
    exact: true,
  });
  await maybeLater
    .waitFor({ state: 'visible', timeout: 1500 })
    .catch(() => undefined);
  if (await maybeLater.isVisible().catch(() => false)) await maybeLater.click();
}

async function expectImageDecoded(image: Locator, timeout = 12_000) {
  await expect
    .poll(
      () =>
        image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      { timeout },
    )
    .toBeGreaterThan(0);
}

async function seedLocalMutualMatch(page: Page) {
  const accounts = await page.evaluate(() => {
    const current = localStorage.getItem('pulse-session');
    if (!current?.startsWith('test')) return null;
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
    return { current, other };
  });

  if (accounts) {
    const session = await page.request.get('/api/auth/session');
    if (session.ok()) {
      const toUserId = (email: string) =>
        `test-${email.slice(4, email.indexOf('@')).padStart(3, '0')}`;
      const stamp = `${test.info().project.name}-${Date.now()}`;
      const currentLike = await page.request.post('/api/interactions', {
        data: {
          targetUserId: toUserId(accounts.other),
          kind: 'like',
          targetType: 'profile',
          idempotencyKey: `ui-current-${stamp}`,
        },
      });
      if (!currentLike.ok())
        throw new Error(
          `Unable to seed current-user like: ${currentLike.status()}`,
        );

      const reciprocal = await playwrightRequest.newContext({
        baseURL: new URL(page.url()).origin,
      });
      try {
        const login = await reciprocal.post('/api/auth/login', {
          data: {
            email: accounts.other,
            password: 'SpikeDate2026!',
          },
        });
        if (!login.ok())
          throw new Error(
            `Unable to sign in reciprocal user: ${login.status()}`,
          );
        const otherLike = await reciprocal.post('/api/interactions', {
          data: {
            targetUserId: toUserId(accounts.current),
            kind: 'like',
            targetType: 'profile',
            idempotencyKey: `ui-reciprocal-${stamp}`,
          },
        });
        if (!otherLike.ok())
          throw new Error(
            `Unable to seed reciprocal like: ${otherLike.status()}`,
          );
      } finally {
        await reciprocal.dispose();
      }
    }
  }
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
  await expect(page.getByLabel('Email')).toBeHidden();
  const phoneSuffix = String(
    1000 +
      ((Date.now() + (testInfo.project.name === 'ios-mobile' ? 0 : 1)) % 9000),
  );
  await page.getByLabel('Mobile number').fill(`+1 202 555 ${phoneSuffix}`);
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(
    page.getByText(/(?:Local test code|Preview code): 123456/i),
  ).toBeVisible();
  await page.getByLabel('Six-digit verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByText('Verified and kept private')).toBeVisible();
  await expect(page.getByText(/never appears on your profile/i)).toBeVisible();
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
});

test('discovery actions and full profile remain usable', async ({ page }) => {
  await signIn(page);
  await expectImageDecoded(
    page.locator('.discover-screen .cinematic-photo-main'),
  );
  const homePortrait = page.locator('.profile-card .cinematic-photo-main');
  await expect(homePortrait).toBeVisible();
  await expect(homePortrait).toHaveCSS('object-fit', 'cover');
  await expect(homePortrait).toHaveCSS('filter', 'none');
  await expect(
    page.locator('.profile-card .cinematic-photo-backdrop'),
  ).toHaveCount(0);
  await expect(
    page.locator('.profile-card .cinematic-photo-grade'),
  ).toBeVisible();
  const presence = page.locator('.profile-presence');
  if (await presence.count()) {
    await expect(
      page.getByLabel(/was active in the last 15 minutes|is online now/),
    ).toBeVisible();
    await expect(presence).toHaveText(/^(Active recently|Online now)$/);
  }
  await expect(
    page.getByRole('button', { name: /Like .*$/ }).first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Super Spike/i })).toHaveCount(
    0,
  );
  await expect(
    page
      .getByRole('button', { name: /Send .* a Spike introduction/ })
      .or(page.getByRole('button', { name: /^Message / })),
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
    dialog
      .getByRole('button', { name: /Send a Spike introduction/ })
      .or(dialog.getByRole('button', { name: 'Message match', exact: true })),
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

test('iPhone 15 home stays full screen and touch swipes profiles', async ({
  page,
}) => {
  await signIn(page);
  await page.evaluate(() => {
    document.documentElement.dataset.nativePlatform = 'ios';
  });
  const viewport = page.viewportSize();
  expect(viewport).toEqual({ width: 393, height: 659 });

  const frame = page.locator('.phone-frame');
  const card = page.locator('.discover-screen > .profile-card');
  await expect(frame).toBeVisible();
  await expect(card).toBeVisible();
  const [frameBox, cardBox] = await Promise.all([
    frame.boundingBox(),
    card.boundingBox(),
  ]);
  expect(frameBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  expect(frameBox!.x).toBeGreaterThanOrEqual(-1);
  expect(frameBox!.y).toBeGreaterThanOrEqual(-1);
  expect(frameBox!.x + frameBox!.width).toBeLessThanOrEqual(
    viewport!.width + 1,
  );
  expect(frameBox!.y + frameBox!.height).toBeLessThanOrEqual(
    viewport!.height + 1,
  );
  expect(
    await page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    })),
  ).toEqual({ scrollY: 0, scrollHeight: 659, clientHeight: 659 });

  const firstProfile = await card.locator('.name-row h1').innerText();
  let interactionPosts = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/interactions'
    )
      interactionPosts += 1;
  });
  const client = await page.context().newCDPSession(page);
  const y = cardBox!.y + cardBox!.height * 0.48;
  const startX = cardBox!.x + cardBox!.width * 0.78;
  const endX = cardBox!.x + cardBox!.width * 0.2;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y }],
  });
  for (let step = 1; step <= 5; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX + ((endX - startX) * step) / 5, y }],
    });
    await page.waitForTimeout(16);
  }
  await expect(card).toHaveClass(/gesture-dragging/);
  expect(
    await card.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe('0s');
  await expect(card).toHaveAttribute('style', /translate3d\(-/);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(card.locator('.name-row h1')).not.toHaveText(firstProfile);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  const secondProfile = await card.locator('.name-row h1').innerText();
  const rightCardBox = await card.boundingBox();
  const rightY = rightCardBox!.y + rightCardBox!.height * 0.48;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      {
        x: rightCardBox!.x + rightCardBox!.width * 0.2,
        y: rightY,
      },
    ],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        x: rightCardBox!.x + rightCardBox!.width * 0.8,
        y: rightY,
      },
    ],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(card.locator('.name-row h1')).not.toHaveText(secondProfile);
  expect(interactionPosts).toBe(0);

  const [filterBox, liftBox] = await Promise.all([
    page.getByRole('button', { name: 'Filter profiles' }).boundingBox(),
    page.getByRole('button', { name: /Lift my profile/i }).boundingBox(),
  ]);
  expect(filterBox!.y).toBeGreaterThanOrEqual(50);
  expect(liftBox!.y).toBeGreaterThanOrEqual(50);
  await page.screenshot({
    path: 'outputs/qa/ios15-safe-area-home.png',
    fullPage: false,
  });

  const lateDismiss = page.getByRole('button', { name: /^Dismiss /i });
  if (
    await lateDismiss
      .first()
      .isVisible()
      .catch(() => false)
  )
    await lateDismiss.first().click();

  const nextCardBox = await card.boundingBox();
  const centerX = nextCardBox!.x + nextCardBox!.width * 0.46;
  const startY = nextCardBox!.y + nextCardBox!.height * 0.68;
  const endY = nextCardBox!.y + nextCardBox!.height * 0.3;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: centerX, y: startY }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: centerX, y: endY }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(
    page.getByRole('dialog', { name: /full profile/i }),
  ).toBeVisible();
  await page.screenshot({
    path: 'outputs/qa/ios15-full-profile.png',
    fullPage: false,
  });

  await page.getByRole('button', { name: 'Close full profile' }).click();
  for (const tab of ['Galaxy', 'Likes', 'Chat'] as const) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const header = page.locator(
      `.phone-frame[data-active-tab='${tab}'] .page-header`,
    );
    await expect(header).toBeVisible();
    expect((await header.boundingBox())!.y).toBeGreaterThanOrEqual(59);
  }

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  const previewButton = page.getByRole('button', {
    name: 'Preview my profile card',
  });
  await expect(previewButton).toBeVisible();
  expect((await previewButton.boundingBox())!.y).toBeGreaterThanOrEqual(59);
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  const registration = page.locator('.registration-dialog');
  await expect(registration).toBeVisible();
  const registrationBox = await registration.boundingBox();
  expect(registrationBox!.y).toBeGreaterThanOrEqual(59);
  expect(registrationBox!.y + registrationBox!.height).toBeLessThanOrEqual(
    viewport!.height - 33,
  );
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
  const matchChat = page.getByRole('button', { name: 'Back to chats' });
  const likeUpgrade = page.getByRole('heading', {
    name: /Keep liking today|Keep connecting today/,
  });
  await expect
    .poll(async () => {
      if ((await matchChat.isVisible()) || (await likeUpgrade.isVisible()))
        return true;
      const currentLike = page
        .getByRole('button', { name: /^Like [A-Za-z]/ })
        .first();
      return (
        (await currentLike.count()) > 0 &&
        (await currentLike.getAttribute('aria-label')) !== firstLikeLabel
      );
    })
    .toBe(true);
  if (await matchChat.isVisible()) {
    await matchChat.click();
    await page.getByRole('button', { name: 'Spike', exact: true }).click();
  } else if (await likeUpgrade.isVisible()) {
    await expect(page.getByRole('dialog')).toContainText('Likes today');
    await page
      .getByRole('button', { name: 'Close subscription details' })
      .click();
  }
  await expect(
    page.getByRole('button', { name: /^Like [A-Za-z]/ }).first(),
  ).toBeVisible();

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
  const upgrade = page.getByRole('heading', { name: 'Send another Spike' });
  await expect
    .poll(
      async () =>
        (await upgrade.isVisible()) ||
        (await page
          .getByRole('button', { name: /^Like [A-Za-z]/ })
          .first()
          .getAttribute('aria-label')) !== firstSpikeLabel,
    )
    .toBe(true);
  if (await upgrade.isVisible()) {
    await expect(page.getByRole('dialog')).toContainText('0 Spikes available');
    await page
      .getByRole('button', { name: 'Close subscription details' })
      .click();
    await expect(
      page.getByRole('button', { name: /^Like [A-Za-z]/ }).first(),
    ).toHaveAttribute('aria-label', firstSpikeLabel!);
  }
});

test('Send Spike focused composer keeps context and action visible on mobile', async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole('button', { name: /Send .* a Spike introduction/ })
    .click();
  const dialog = page.getByRole('dialog', { name: /^Spike /i });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText('An introduction that stands out'),
  ).toBeVisible();
  await expect(dialog.locator('.spike-recipient')).toContainText(
    'Spikes left this week',
  );
  await expect(
    dialog.getByRole('button', { name: 'Prompt', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('.spike-context-quote')).toContainText(
    'THEIR PROMPT',
  );
  await page.screenshot({
    path: test.info().outputPath('send-spike-prompt.png'),
  });
  await dialog.getByRole('button', { name: 'Photo', exact: true }).click();
  await expect(dialog.locator('.spike-context-quote')).toContainText(
    'THEIR PHOTO',
  );
  const interest = dialog.getByRole('button', {
    name: 'Interest',
    exact: true,
  });
  const hasSharedInterest = await interest.isVisible();
  if (hasSharedInterest) {
    await interest.click();
    await expect(dialog.locator('.spike-context-quote')).toContainText(
      'SHARED INTEREST',
    );
  }
  await expect(dialog.getByLabel('Profile note')).toBeVisible();
  const action = dialog.getByRole('button', {
    name: 'Send Spike',
    exact: true,
  });
  await expect(action).toBeVisible();
  await expect(dialog).toContainText(
    'Uses 1 Spike · delivered at the top of Likes',
  );
  const geometry = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const actionBounds = element
      .querySelector('.note-dialog-actions')!
      .getBoundingClientRect();
    return {
      dialogLeft: bounds.left,
      dialogRight: bounds.right,
      actionBottom: actionBounds.bottom,
      width: window.innerWidth,
      height: window.innerHeight,
      overflow: element.scrollWidth - element.clientWidth,
    };
  });
  expect(geometry.dialogLeft).toBeGreaterThanOrEqual(-1);
  expect(geometry.dialogRight).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.height + 1);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: test.info().outputPath('send-spike-interest.png'),
  });
  await page.route('**/api/interactions', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        interaction: { kind: 'super_spike' },
        superSpikesRemaining: 2,
      }),
    });
  });
  const request = page.waitForRequest(
    (item) =>
      item.url().endsWith('/api/interactions') && item.method() === 'POST',
  );
  await action.click();
  const payload = (await request).postDataJSON() as {
    targetType: string;
    targetRef: string;
  };
  expect(payload.targetType).toBe(hasSharedInterest ? 'profile' : 'photo');
  expect(payload.targetRef).toContain(
    hasSharedInterest ? 'Interest ·' : 'Photo 1',
  );
  await expect(dialog).not.toBeVisible();
});

test('Galaxy, Likes, Chat, and Profile navigation expose primary actions', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: /Lift my profile|View active Profile Lift/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Galaxy', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Find your kind of connection')).toBeVisible();

  await page.getByRole('button', { name: /^Likes/ }).click();
  await expect(
    page.getByRole('button', {
      name: /Lift my profile|View active Profile Lift/,
    }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Likes' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Liked you/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /You liked/ })).toBeVisible();
  await page.getByRole('tab', { name: /Matches/ }).click();
  await expect(page.locator('.matches-list')).toBeVisible();

  await page.getByRole('button', { name: /^Chat/ }).click();
  await expect(
    page.getByRole('button', {
      name: /Lift my profile|View active Profile Lift/,
    }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chats' })).toBeVisible();
  await expect(
    page.locator('.chat-row').first().or(page.getByText('No matches yet')),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: /Lift my profile|View active Profile Lift/,
    }),
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
  await expect(page.locator('.push-settings-card')).toContainText(
    'Connection updates appear in-app.',
  );
  await expect(
    page.locator('.push-settings-card').getByText('New matches'),
  ).toHaveCSS('font-weight', '500');
  await expect(
    page.locator('.push-settings-card').getByText('Choose what reaches you'),
  ).toHaveCSS('font-weight', '500');
  await expect(page.locator('.push-settings-card')).not.toContainText(
    'Delivered in-app; push is used only on registered devices.',
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
    .locator('.home-today-tools')
    .getByRole('button', { name: 'Post or edit your Today update' });
  await expect(homeToday).toBeVisible();
  await expect(homeToday).toHaveText('');
  await expect(homeToday.locator('svg')).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
  await homeToday.click();
  await expect(
    page.getByRole('dialog', { name: 'Today', exact: true }),
  ).toBeVisible();
  const todaySheet = page.getByRole('dialog', { name: 'Today', exact: true });
  await expect(todaySheet).toContainText('24-HOUR MOMENT');
  await expect(todaySheet).toHaveCSS('backdrop-filter', 'none');
  const todayBounds = await todaySheet.boundingBox();
  expect(todayBounds).not.toBeNull();
  expect(todayBounds!.x).toBeGreaterThanOrEqual(-1);
  expect(todayBounds!.x + todayBounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  );
  expect(todayBounds!.y + todayBounds!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height + 1,
  );
  await page.screenshot({
    path: test.info().outputPath('today-editorial.png'),
  });
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
  await expect(
    page.getByRole('dialog', { name: 'Today', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close Today composer' }).click();

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page
    .locator('.profile-passport-topbar')
    .getByRole('button', { name: 'Post or edit your Today update' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Today', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('What are you doing today?');
  await expect(dialog.getByLabel('Today update')).toBeVisible();
  const tonightSwitch = dialog.getByLabel('Available tonight');
  await expect(tonightSwitch).toBeVisible();
  const switchBounds = await tonightSwitch.boundingBox();
  expect(switchBounds?.width ?? 0).toBeGreaterThanOrEqual(48);
  expect(switchBounds?.height ?? 0).toBeGreaterThanOrEqual(28);
  await expect(dialog.getByLabel('Today prompt')).toHaveCount(0);
  await expect(dialog.getByLabel('Today visibility')).toHaveCount(0);
  await expect(dialog.getByLabel('Allow Today replies')).toHaveCount(0);
  await expect(dialog.getByLabel('Choose Today photo')).toHaveCount(0);
  await expect(page.getByLabel('Available from')).toHaveCount(0);
  await expect(page.getByLabel('Available until')).toHaveCount(0);
  await dialog.getByLabel('Today update').fill('Coffee and a walk after work.');
  await tonightSwitch.check();
  const availabilitySaved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/availability') &&
      response.request().method() === 'PUT',
    { timeout: 30_000 },
  );
  await dialog
    .getByRole('button', { name: /Post for today|Save Today/ })
    .click();
  const availabilityResponse = await availabilitySaved;
  await test.info().attach('Today-availability-response', {
    body: JSON.stringify(
      {
        status: availabilityResponse.status(),
        request: availabilityResponse.request().postDataJSON(),
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(
    availabilityResponse.ok(),
    `Today availability save: HTTP ${availabilityResponse.status()}; see attached request window`,
  ).toBe(true);
  await expect(dialog).not.toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.today-profile-manager')).toHaveCount(0);
  const profileToday = page
    .locator('.profile-passport-topbar')
    .getByRole('button', { name: 'Post or edit your Today update' });
  await expect(profileToday).toHaveText('');
  await profileToday.click();
  await expect(dialog.getByLabel('Today update')).toHaveValue(
    'Coffee and a walk after work.',
  );
  await expect(dialog.getByLabel('Available tonight')).toBeChecked();
  await expect(page.getByText('AVAILABILITY', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close Today composer' }).click();
  await page.getByRole('button', { name: 'Preview my profile card' }).click();
  const preview = page.locator('.preview-screen');
  await expect(preview).toBeVisible();
  await expect(preview.locator('.today-card-pill')).toContainText(
    'Coffee and a walk after work.',
  );
  await expect(preview.locator('.tonight-card-status')).toContainText(
    'Available tonight',
  );
  await expect(preview.locator('.cinematic-photo-main')).not.toHaveAttribute(
    'src',
    /_next\/image/,
  );
  await expect
    .poll(() =>
      preview.locator('.cinematic-photo-main').evaluate((image) => {
        const photo = image as HTMLImageElement;
        return photo.naturalWidth > 0;
      }),
    )
    .toBe(true);
  await expect(
    preview.getByRole('button', { name: /Send a Spike/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to profile' }).click();
  await expect
    .poll(async () => {
      const response = await page.request.get('/api/profile');
      if (!response.ok()) return '';
      const data = (await response.json()) as {
        dailyUpdate?: { text?: string } | null;
      };
      return data.dailyUpdate?.text ?? '';
    })
    .toBe('Coffee and a walk after work.');
  await page.reload();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Preview my profile card' }).click();
  await expect(page.locator('.preview-screen .today-card-pill')).toContainText(
    'Coffee and a walk after work.',
  );
  await expect(
    page.locator('.preview-screen .tonight-card-status'),
  ).toContainText('Available tonight');
  await page
    .getByRole('button', { name: 'Open your full profile preview' })
    .click();
  const fullPreview = page.locator('.profile-preview-sheet');
  await expect(fullPreview).toBeVisible();
  await expect(fullPreview.locator('.full-preview-today')).toContainText(
    'Coffee and a walk after work.',
  );
  await expect(fullPreview.locator('.full-preview-today')).toContainText(
    'Available tonight',
  );
  await fullPreview.getByRole('button', { name: 'Close full profile' }).click();
  await expect(page.locator('.preview-screen')).toBeVisible();
});

test('private date planning requires the safety gate on mobile', async ({
  page,
}) => {
  await signIn(page);
  await seedLocalMutualMatch(page);
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  await page.getByRole('tab', { name: 'Plans', exact: true }).click();
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
    name: /Your photos are verified|Verify your photos/i,
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
  await expect(lift).toContainText('PROFILE LIFT');
  await expect(lift).toHaveCSS('backdrop-filter', 'none');
  const liftBounds = await lift.boundingBox();
  expect(liftBounds).not.toBeNull();
  expect(liftBounds!.x).toBeGreaterThanOrEqual(-1);
  expect(liftBounds!.x + liftBounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  );
  expect(liftBounds!.y + liftBounds!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height + 1,
  );
  await page.screenshot({ path: test.info().outputPath('lift-editorial.png') });
  await lift.getByText('How Profile Lift works', { exact: true }).click();
  await lift.getByText('Get more Profile Lifts', { exact: true }).click();
  const liftAction = lift.getByRole('button', {
    name: /Start .* Profile Lift/i,
  });
  if (await liftAction.isVisible()) {
    const actionBounds = await liftAction.boundingBox();
    expect(actionBounds).not.toBeNull();
    expect(actionBounds!.y + actionBounds!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height + 1,
    );
  }
  await expect(
    lift
      .getByRole('button', { name: /Start .* Profile Lift/i })
      .or(lift.getByRole('button', { name: /Profile Lift is running/i })),
  ).toBeVisible();
  await expect(
    lift.getByRole('button', { name: /Close Profile Lift/i }),
  ).toBeVisible();
  await lift.getByRole('button', { name: /Close Profile Lift/i }).click();

  await page.evaluate(() => {
    const email = localStorage.getItem('pulse-session');
    if (!email) return;
    localStorage.setItem(`pulse-membership:${email}`, 'free');
    localStorage.setItem(`pulse-super-pulses-v3:${email}`, '0');
    localStorage.setItem(
      `pulse-daily-likes:${email}`,
      JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        remaining: 0,
      }),
    );
  });
  await page.reload();

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Subscription', exact: true }),
  ).toBeVisible();
  await page.locator('#profile-subscription').click();
  const subscription = page.getByRole('dialog', {
    name: /Keep (?:connecting|liking) today/i,
  });
  await expect(subscription).toBeVisible();
  await expect(
    subscription.getByRole('button', { name: /Close/i }),
  ).toBeVisible();
  await expect(subscription).toContainText('$4.00');
  await expect(subscription).toContainText(
    'Likes and Spikes renew through SpikeDate+',
  );
  await expect(
    subscription.getByRole('button', {
      name: 'Buy Profile Lifts without subscribing',
    }),
  ).toBeVisible();
  await expect(
    subscription.getByRole('button', { name: /Annual/i }),
  ).toHaveCount(0);
  await subscription.getByRole('button', { name: 'Weekly' }).click();
  await expect(subscription).toContainText('$1.00');
  await expect(
    subscription.getByRole('button', { name: /Continue · \$1\.00 \/ week/i }),
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
  const inventoryResponse = await page.request.get('/api/profile');
  const originalMedia = (await inventoryResponse.json()).media as {
    id: string;
    type: string;
  }[];
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Edit photos' }).click();
  const registration = page.getByRole('dialog', {
    name: 'Your photos',
  });
  await expect(registration).toBeVisible();
  const firstPhoto = originalMedia.find((item) => item.type === 'photo');
  if (firstPhoto)
    await expect(
      registration.locator('.profile-media-tile img').first(),
    ).toHaveAttribute('src', new RegExp(firstPhoto.id));
  const before = await registration.locator('.profile-media-tile').count();
  const uploadResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/media') &&
      response.request().method() === 'POST',
  );
  await registration
    .getByLabel('Add and crop profile photo')
    .setInputFiles(path.resolve('public/maya.png'));

  const cropper = page.getByRole('dialog', { name: 'Review your photo' });
  await expect(cropper).toBeVisible();
  const cropBounds = await cropper.locator('.photo-crop-stage').boundingBox();
  expect(cropBounds).not.toBeNull();
  expect(cropBounds!.width / cropBounds!.height).toBeCloseTo(0.8, 1);
  await cropper.getByLabel('Photo zoom').fill('1.18');
  await cropper.getByRole('button', { name: 'Save photo' }).click();
  const upload = await uploadResponse;
  expect(upload.ok()).toBe(true);
  const uploadedId = (await upload.json()).media.id as string;
  await expect(cropper).toBeHidden({ timeout: 30_000 });
  await expect(registration.locator('.profile-media-tile')).toHaveCount(
    before + 1,
  );
  await expectImageDecoded(
    registration.locator('.profile-media-tile').last().locator('img'),
    30_000,
  );

  const lastPhoto = registration
    .locator('.profile-media-tile')
    .filter({ has: page.locator(`img[src*="${uploadedId}"]`) });
  const uploadedSource = await lastPhoto.locator('img').getAttribute('src');
  expect(uploadedSource).toMatch(/(?:\/api\/media\/|^data:image\/)/);
  const remove = lastPhoto.getByRole('button', {
    name: /Remove profile photo/i,
  });
  const deleted = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/media/${uploadedId}`) &&
      response.request().method() === 'DELETE',
  );
  await remove.click();
  expect((await deleted).ok()).toBe(true);
  await expect(registration.locator('.profile-media-tile')).toHaveCount(before);
  const remaining = (await (await page.request.get('/api/profile')).json())
    .media as { id: string }[];
  expect(remaining.map((item) => item.id)).not.toContain(uploadedId);
  for (const item of originalMedia)
    expect(remaining.map((photo) => photo.id)).toContain(item.id);
});
