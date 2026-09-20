import { expect, test } from '@playwright/test';
import { loginSynthetic } from '../qa/ui-helpers';
import { syntheticProfiles } from '@/lib/synthetic-profiles';
test.skip(
  ({ baseURL }) => !baseURL || !/localhost|127\.0\.0\.1/.test(baseURL),
  'Connection fixture writes are local only.',
);

test('connection details: edit, regular fields, value limit, reload and own full profile', async ({
  page,
}, info) => {
  const number = info.project.name === 'android-mobile' ? 52 : 51;
  await loginSynthetic(page, number);
  const original = (await (await page.request.get('/api/profile')).json())
    .connection;
  try {
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page
      .getByRole('button', { name: 'Edit relationship goals', exact: true })
      .click();
    const dialog = page.locator('.registration-dialog');
    await expect(
      dialog.getByLabel('Relationship style', { exact: true }),
    ).toBeVisible();
    await dialog
      .getByLabel('Relationship style', { exact: true })
      .selectOption('Ethical non-monogamy');
    for (const value of original.values)
      await dialog.getByRole('button', { name: value, exact: true }).click();
    for (const value of ['Kindness', 'Honesty', 'Family'])
      await dialog.getByRole('button', { name: value, exact: true }).click();
    await expect(
      dialog.getByRole('button', { name: 'Curiosity', exact: true }),
    ).toBeDisabled();
    await dialog
      .getByLabel('Dating pace', { exact: true })
      .selectOption('Take it slowly');
    await dialog
      .getByLabel('Communication preference', { exact: true })
      .selectOption('Calls');
    await dialog
      .getByLabel('Languages spoken', { exact: true })
      .fill('English, French');
    await dialog
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await expect(
      page.getByRole('button', {
        name: 'Edit relationship goals',
        exact: true,
      }),
    ).toContainText('Ethical non-monogamy');
    const stored = (await (await page.request.get('/api/profile')).json())
      .connection;
    expect(stored.values).toEqual(['Kindness', 'Honesty', 'Family']);
    expect(stored.languages).toEqual(['English', 'French']);
    await page.getByRole('button', { name: 'Preview my profile card' }).click();
    const preview = page.locator('.preview-screen');
    await preview
      .getByRole('button', { name: 'Open your full profile preview' })
      .focus();
    await page.keyboard.press('Enter');
    const summary = page
      .locator('.profile-preview-sheet')
      .getByRole('region', { name: 'Connection details' });
    await expect(summary).toContainText('Ethical non-monogamy');
    await expect(summary).toContainText('Take it slowly');
    await expect(summary).toContainText('French');
    await info.attach('connection-full-preview', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  } finally {
    expect(
      (
        await page.request.patch('/api/profile', {
          data: { section: 'connection', data: original },
        })
      ).ok(),
    ).toBe(true);
  }
});

test('connection details: another user sees stored details, gallery and unavailable-profile protection', async ({
  page,
}, info) => {
  await loginSynthetic(page, info.project.name === 'android-mobile' ? 54 : 53);
  const response = await (
    await page.request.get('/api/discover?limit=50')
  ).json();
  const later = page.getByRole('button', { name: 'Maybe later', exact: true });
  if (await later.isVisible()) await later.click();
  const card = page.locator('.profile-card');
  const name = (await page
    .getByRole('button', { name: /^Like / })
    .getAttribute('aria-label'))!.replace(/^Like /, '');
  const target = response.profiles.find(
    (x: { name: string }) => x.name === name,
  );
  expect(target).toBeTruthy();
  await card.getByRole('button', { name: new RegExp(`Open ${name}`) }).click();
  const full = page.locator('.profile-sheet');
  const summary = full.getByRole('region', { name: 'Connection details' });
  await expect(summary).toContainText(target.connection.relationshipStyle);
  await expect(summary).toContainText(target.connection.values[0]);
  const expected = syntheticProfiles.find((x) => x.id === target.id)!;
  expect(target.connection).toEqual(expected.connection);
  const initial = await full
    .locator('.cinematic-photo-main')
    .getAttribute('src');
  await full.getByRole('button', { name: 'Next profile photo' }).click();
  await expect(full.locator('.cinematic-photo-main')).not.toHaveAttribute(
    'src',
    initial!,
  );
  await expect(full.locator('.profile-photo-strip button')).toHaveCount(3);
  await info.attach('other-user-full-profile', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(
    (await page.request.get(`/api/profiles/${target.id}/connection`)).ok(),
  ).toBe(true);
  expect(
    (await page.request.get('/api/profiles/not-a-user/connection')).status(),
  ).toBe(404);
});

test('connection details: matched full profile from Chats uses stored data', async ({
  page,
}) => {
  await loginSynthetic(page, 1);
  await page.getByRole('button', { name: /^Chat/ }).click();
  const chats = (await (await page.request.get('/api/conversations')).json())
    .conversations;
  const target = chats.find(
    (chat: { other_user_id?: string; display_name: string }) =>
      chat.display_name === 'Noah',
  );
  expect(target).toBeTruthy();
  await page
    .getByRole('button', { name: "Open Noah's full profile", exact: true })
    .first()
    .click();
  const full = page.locator('.profile-sheet');
  await expect(
    full.getByRole('region', { name: 'Connection details' }),
  ).toContainText(syntheticProfiles[1].connection.relationshipStyle);
  await expect(
    full.getByRole('region', { name: 'Connection details' }),
  ).toContainText(syntheticProfiles[1].connection.values[0]);
});
