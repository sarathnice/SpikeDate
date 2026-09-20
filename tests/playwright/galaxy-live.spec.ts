import { expect, test } from '@playwright/test';
import { galaxyRoomNames, matchesGalaxyRoom } from '../../lib/galaxy-rooms';
import { loginSynthetic } from '../qa/ui-helpers';

test('Galaxy rooms use live eligible people, navigate through cards, and open full profiles', async ({
  page,
}) => {
  await loginSynthetic(page, 1);
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  const hub = page.locator('.explore-hub');
  await expect(hub.locator('.room-tile em').first()).not.toContainText(
    'Checking',
  );
  const response = await page.evaluate(async () => {
    const result = await fetch('/api/discover?limit=50&includeMatches=1');
    if (!result.ok) throw new Error(`Discover returned ${result.status}`);
    return result.json() as Promise<{
      profiles: Array<{
        name: string;
        interests: string[];
        facts: { pets?: string };
        availability?: { startAt: string; endAt: string } | null;
      }>;
    }>;
  });
  const now = Date.now();
  for (const room of galaxyRoomNames) {
    const tile = hub
      .locator('.room-tile')
      .filter({ has: page.locator('strong', { hasText: room }) });
    const label = (await tile.locator('em').textContent())?.trim() ?? '';
    const count = Number(label.match(/^(\d+) /)?.[1]);
    expect(Number.isInteger(count), `${room}: ${label}`).toBe(true);
    const eligible = response.profiles.filter((profile) =>
      matchesGalaxyRoom(room, profile, now),
    );
    expect(
      count,
      `${room} count must not exceed eligible API people`,
    ).toBeLessThanOrEqual(eligible.length);
    await tile.click();
    const stack = page.locator('.room-stack');
    await expect(stack.locator('.room-header strong')).toHaveText(room);
    await expect(stack.locator('.room-header span').first()).toContainText(
      `${count} `,
    );
    if (count === 0) {
      await expect(stack.locator('.room-empty')).toBeVisible();
      await expect(stack.locator('.profile-card')).toHaveCount(0);
    } else {
      const card = stack.locator('.profile-card');
      await expect(card).toBeVisible();
      const name = (await card.locator('.name-row h1').textContent())
        ?.split(',')[0]
        .trim();
      expect(
        eligible.some((profile) => profile.name === name),
        `${room} showed unrelated person ${name}`,
      ).toBe(true);
      await card.locator('.profile-card-open').click();
      await expect(page.locator('.profile-sheet')).toBeVisible();
      await expect(page.locator('.profile-sheet')).toContainText(name!);
      await page.getByRole('button', { name: 'Close full profile' }).click();
      if (count > 1) {
        await stack
          .locator('.action-row')
          .getByRole('button', { name: /pass/i })
          .click();
        await expect(card.locator('.name-row h1')).not.toContainText(
          `${name},`,
        );
      }
    }
    await page.getByRole('button', { name: 'Back to Galaxy' }).click();
    await expect(hub).toBeVisible();
  }
});

test('Galaxy Plans shows actual matches across all activities, and is compact on phones', async ({
  page,
}) => {
  await loginSynthetic(page, 1);
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  const hub = page.locator('.explore-hub');
  for (const width of [320, 390, 412]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await hub.evaluate((element) => element.scrollWidth),
    ).toBeLessThanOrEqual(width + 1);
  }
  await hub.getByRole('tab', { name: 'Plans', exact: true }).click();
  for (const activity of ['Coffee', 'Dinner', 'Music', 'Walk']) {
    await hub
      .locator('.galaxy-plan-tile')
      .filter({ hasText: activity })
      .click();
    await expect(hub.locator('.galaxy-plan-result')).toContainText(
      `Invite a match to ${activity.toLowerCase()}`,
    );
    await expect(hub.locator('.galaxy-plan-result')).not.toContainText(
      '3 people match',
    );
    await hub
      .getByRole('button', { name: `Plan a ${activity.toLowerCase()} date` })
      .click();
    await expect(page.locator('.plan-dialog')).toBeVisible();
    await expect(page.locator('.plan-dialog')).toContainText(
      new RegExp(activity, 'i'),
    );
    await page.keyboard.press('Escape');
  }
  await hub.getByRole('tab', { name: 'Connect', exact: true }).click();
  await expect(
    hub.getByRole('button', { name: /Play Together/ }),
  ).toBeVisible();
  await hub.getByRole('tab', { name: 'Browse', exact: true }).click();
  await expect(hub.locator('.room-tile')).toHaveCount(8);
});

test('a member without matches sees an honest Plans empty state', async ({
  page,
}) => {
  await loginSynthetic(page, 7);
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  const hub = page.locator('.explore-hub');
  await hub.getByRole('tab', { name: 'Plans', exact: true }).click();
  await expect(hub.locator('.galaxy-plan-result')).toContainText(
    'Match with someone to make a plan',
  );
  await expect(hub.locator('.galaxy-plan-faces img')).toHaveCount(0);
});

test('Tonight updates when a match shares availability, but stays private from non-matches', async ({
  page,
  browser,
}) => {
  await loginSynthetic(page, 2);
  await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
  const tonight = page
    .locator('.room-tile')
    .filter({ has: page.locator('strong', { hasText: 'Tonight' }) });
  await expect(tonight.locator('em')).not.toContainText('Checking');
  const before = Number(
    (await tonight.locator('em').textContent())?.match(/^(\d+)/)?.[1],
  );
  const matchContext = await browser.newContext();
  const matchPage = await matchContext.newPage();
  let originalAvailability: {
    localDate: string;
    startAt: string;
    endAt: string;
    timezone: string;
  } | null = null;
  try {
    await loginSynthetic(matchPage, 1);
    const original = await matchPage.evaluate(async () => {
      const result = await fetch('/api/availability');
      return result.json() as Promise<{
        availability: {
          localDate: string;
          startAt: string;
          endAt: string;
          timezone: string;
        } | null;
      }>;
    });
    originalAvailability = original.availability;
    const windowStart = new Date(Date.now() + 30 * 60_000);
    const windowEnd = new Date(windowStart.getTime() + 2 * 60 * 60_000);
    const update = await matchPage.evaluate(
      async ({ startAt, endAt }) => {
        const result = await fetch('/api/availability', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            localDate: startAt.slice(0, 10),
            startAt,
            endAt,
            timezone: 'UTC',
          }),
        });
        return { status: result.status, body: await result.json() };
      },
      { startAt: windowStart.toISOString(), endAt: windowEnd.toISOString() },
    );
    expect(update.status, JSON.stringify(update.body)).toBe(200);
    const matchedDiscovery = await page.evaluate(async () => {
      const result = await fetch('/api/discover?limit=50&includeMatches=1');
      return result.json() as Promise<{
        profiles: Array<{ id: string; availability?: object | null }>;
      }>;
    });
    expect(
      matchedDiscovery.profiles.find((profile) => profile.id === 'test-001')
        ?.availability,
      JSON.stringify(matchedDiscovery.profiles.map((profile) => profile.id)),
    ).toBeTruthy();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect
      .poll(async () =>
        Number(
          (await tonight.locator('em').textContent())?.match(/^(\d+)/)?.[1],
        ),
      )
      .toBe(before + 1);

    const strangerContext = await browser.newContext();
    try {
      const strangerPage = await strangerContext.newPage();
      await loginSynthetic(strangerPage, 7);
      const strangerDiscovery = await strangerPage.evaluate(async () => {
        const result = await fetch('/api/discover?limit=50&includeMatches=1');
        return result.json() as Promise<{
          profiles: Array<{ id: string; availability?: object | null }>;
        }>;
      });
      expect(
        strangerDiscovery.profiles.find((profile) => profile.id === 'test-001')
          ?.availability,
      ).toBeNull();
    } finally {
      await strangerContext.close();
    }
  } finally {
    await matchPage
      .evaluate(async (previous) => {
        if (previous) {
          await fetch('/api/availability', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(previous),
          });
        } else {
          await fetch('/api/availability', { method: 'DELETE' });
        }
      }, originalAvailability)
      .catch(() => null);
    await matchContext.close();
  }
});

test('a private plan appears for both matches and acceptance/cancellation syncs between them', async ({
  page,
  browser,
}) => {
  await loginSynthetic(page, 1);
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  let serverPlanId: string | undefined;
  const planName = `QA Galaxy sync ${Date.now()}`;
  try {
    await loginSynthetic(otherPage, 2);
    const created = await page.evaluate(async (name) => {
      const response = await fetch('/api/galaxy/plans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          activity: 'Coffee',
          venue: {
            name: 'QA Public Coffee',
            address: '1 Main Street, Boston',
            latitude: 42.36,
            longitude: -71.06,
          },
          startsAt: Date.now() + 20 * 60_000,
          publicVenueConfirmed: true,
          safetyAcknowledged: true,
          inviteeIds: ['test-002'],
        }),
      });
      return { status: response.status, body: await response.json() };
    }, planName);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    serverPlanId = (created.body as { plan: { id: string } }).plan.id;
    const sharedPlan = await otherPage.evaluate(async () => {
      const response = await fetch('/api/galaxy/plans');
      return response.json() as Promise<{
        plans: Array<Record<string, unknown>>;
      }>;
    });
    const visiblePlan = sharedPlan.plans.find(
      (plan) => plan.id === serverPlanId,
    );
    expect(visiblePlan).toBeTruthy();
    expect(visiblePlan).not.toHaveProperty('creator_email');
    expect(visiblePlan).not.toHaveProperty('invitee_email');
    const strangerContext = await browser.newContext();
    try {
      const strangerPage = await strangerContext.newPage();
      await loginSynthetic(strangerPage, 7);
      const hiddenPlans = await strangerPage.evaluate(async () => {
        const response = await fetch('/api/galaxy/plans');
        return response.json() as Promise<{ plans: Array<{ id: string }> }>;
      });
      expect(hiddenPlans.plans.some((plan) => plan.id === serverPlanId)).toBe(false);
    } finally {
      await strangerContext.close();
    }
    await page.getByRole('button', { name: 'Galaxy', exact: true }).click();
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    const creatorCard = page
      .locator('.galaxy-upcoming-card')
      .filter({ hasText: planName });
    await expect(creatorCard).toContainText('Invite sent to');
    await otherPage
      .getByRole('button', { name: 'Galaxy', exact: true })
      .click();
    await otherPage.getByRole('tab', { name: 'Plans', exact: true }).click();
    const recipientCard = otherPage
      .locator('.galaxy-upcoming-card')
      .filter({ hasText: planName });
    await expect(recipientCard).toContainText('Invitation from');
    await recipientCard
      .getByRole('button', { name: 'Accept', exact: true })
      .click();
    await expect(recipientCard.locator('.plan-status')).toContainText(
      'accepted',
    );
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(creatorCard.locator('.plan-status')).toContainText('accepted');
    await creatorCard
      .getByRole('button', { name: `Cancel ${planName}` })
      .click();
    await expect(creatorCard.locator('.plan-status')).toContainText(
      'cancelled',
    );
    await otherPage.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(recipientCard.locator('.plan-status')).toContainText(
      'cancelled',
    );
  } finally {
    if (serverPlanId)
      await page
        .evaluate(
          (id) =>
            fetch(`/api/galaxy/plans/${encodeURIComponent(id)}`, {
              method: 'DELETE',
            }),
          serverPlanId,
        )
        .catch(() => null);
    await otherContext.close();
  }
});
