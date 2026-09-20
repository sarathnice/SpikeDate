import { test, expect, type Page } from '@playwright/test';
import { datingGames } from '../../lib/games';
import { loginSynthetic } from '../qa/ui-helpers';

test('accepted-match chat exposes games without hiding the composer', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await loginSynthetic(page, 1);
  await page.evaluate(() =>
    localStorage.setItem(
      'pulse-interactions',
      JSON.stringify([
        {
          id: 'games-ui-match',
          fromEmail: 'test001@spikedate.test',
          toEmail: 'test002@spikedate.test',
          kind: 'like',
          target: 'Photo 1',
          note: '',
          status: 'accepted',
          createdAt: new Date().toISOString(),
        },
      ]),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: /^Chat/ }).click();
  await page
    .getByRole('button', { name: 'Chat with Noah', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Games and date plans', exact: true })
    .click();
  await expect(page.locator('.play-together-button')).toBeVisible();
  const bounds = await page.locator('.composer input').evaluate((el) => ({
    bottom: el.getBoundingClientRect().bottom,
    height: window.innerHeight,
  }));
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
  await info.attach('matched-chat-game-control', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.locator('.play-together-button').click();
  const currentGame = page.getByRole('dialog').getByRole('region', {
    name: 'Current game',
  });
  if (await currentGame.isVisible()) {
    const browseGames = page.getByRole('button', {
      name: 'Browse games',
      exact: true,
    });
    if (await browseGames.isVisible()) await browseGames.click();
    else
      await page
        .getByRole('button', { name: 'Leave game · keep your match' })
        .click();
  }
  await expect(page.locator('.game-catalog > button')).toHaveCount(10);
});
async function switchPlayer(page: Page, name: string) {
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await page.getByRole('button', { name: `Play as ${name}` }).click();
  await page.locator('.play-together-button').click();
}
for (const game of datingGames) {
  test(`two-player ${game.name}: invitation, three rounds and reveal`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/design/games');
    await page.evaluate(() =>
      localStorage.removeItem('spikedate-game-demo:Alex|Lena'),
    );
    await page.locator('.play-together-button').click();
    await expect(page.locator('.game-catalog > button')).toHaveCount(10);
    if (game.id === 'this-or-that')
      await info.attach('game-catalog', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    await page
      .locator('.game-catalog > button')
      .filter({ hasText: game.name })
      .click();
    await expect(page.getByRole('dialog')).toContainText(
      'Waiting for Lena to accept',
    );
    await switchPlayer(page, 'Lena');
    await page
      .getByRole('button', { name: 'Accept game', exact: true })
      .click();
    for (let round = 0; round < 3; round++) {
      if (game.id === 'this-or-that' && round === 0)
        await info.attach('active-game', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      const prompt = game.rounds[round];
      if (prompt.options)
        await page.locator('.game-options button').first().click();
      else
        await page
          .getByLabel('Your game answer')
          .fill(`Lena’s original answer ${round + 1}`);
      if (prompt.guess)
        await page
          .getByLabel('Guess partner choice')
          .selectOption(prompt.options![0]);
      await page.getByRole('button', { name: 'Lock my answer' }).click();
      await expect(page.getByRole('dialog')).toContainText('Answer saved');
      await switchPlayer(page, 'Alex');
      // Only previous rounds are revealed while the current answer stays private.
      await expect(page.locator('.game-reveals article')).toHaveCount(round);
      if (prompt.options)
        await page.locator('.game-options button').last().click();
      else
        await page
          .getByLabel('Your game answer')
          .fill(`Alex’s original answer ${round + 1}`);
      if (prompt.guess)
        await page
          .getByLabel('Guess partner choice')
          .selectOption(prompt.options![0]);
      await page.getByRole('button', { name: 'Lock my answer' }).click();
      await expect(page.locator('.game-reveals article')).toHaveCount(
        round + 1,
      );
      if (round < 2) await switchPlayer(page, 'Lena');
    }
    await expect(
      page.getByRole('button', { name: 'Continue chatting', exact: true }),
    ).toBeVisible();
    if (game.id === 'this-or-that')
      await info.attach('completed-game', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    await page
      .getByRole('button', { name: 'Browse games', exact: true })
      .click();
    await expect(page.locator('.game-catalog > button')).toHaveCount(10);
    if (game.id === 'this-or-that')
      await info.attach('ten-game-picker', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
  });
}
test('decline, leave, skip, persisted round and mood filters', async ({
  page,
}) => {
  await page.goto('/design/games');
  await page.evaluate(() =>
    localStorage.removeItem('spikedate-game-demo:Alex|Lena'),
  );
  await page.locator('.play-together-button').click();
  await page.getByRole('button', { name: 'Flirty', exact: true }).click();
  await expect(page.locator('.game-catalog > button')).toHaveCount(2);
  await page.locator('.game-catalog > button').first().click();
  await switchPlayer(page, 'Lena');
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Game declined');
  await page.locator('.game-catalog > button').first().click();
  await switchPlayer(page, 'Alex');
  await page.getByRole('button', { name: 'Accept game', exact: true }).click();
  await page
    .getByRole('button', { name: 'Skip question', exact: true })
    .click();
  await page.reload();
  await page.locator('.play-together-button').click();
  await expect(page.getByRole('dialog')).toContainText('Answer saved');
  await page
    .getByRole('button', { name: 'Leave game · keep your match' })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Game left');
});
