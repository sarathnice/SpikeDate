# Matched-pair live Arcade

Chat → open an accepted conversation → Play Together → Arcade.

- **Four in a Row:** a 7×6 board, alternating turns, four directions, full-column rejection, win/draw results. The final board stays visible.
- **Bubble Duel:** both players start with the same 5×6 board. Pop orthogonally connected groups of at least two. Each player has an independent board; scores update live. The server finishes the round after 45 seconds, including when a player disconnects. Higher score wins; equal scores tie.
- **Guess Next:** both players lock a coral/blue prediction. The server draws the next colour only after both predictions arrive, then reveals the round to both. Five rounds; no advance outcomes or partner predictions are sent to clients.

These are friendly games, not gambling or measures of relationship compatibility. Chess is not part of this release. The existing ten Conversation games remain in a separate tab.

## Real-time architecture

`workers/stage-entry.js` forwards the existing application and intercepts `/api/arcade/live`. Its gateway authenticates the normal HttpOnly session cookie, enforces same-origin handshakes, connection readiness and active match membership, and overwrites identity headers before forwarding to the room.

`ArcadeRoom` is one SQLite-backed Cloudflare Durable Object per conversation, using the [WebSocket Hibernation API](https://developers.cloudflare.com/durable-objects/best-practices/websockets/). State is saved in object storage; **arcade boards do not add D1 tables**. Existing D1 `users`, `sessions`, `profiles`, `matches`, `conversations`, `safety_actions` and `notifications` provide authentication, eligibility and invitation notifications. Conversation games still use `game_sessions` / `game_answers`.

All mutations are server-controlled and serialized. Revisions reject stale board/turn actions; unique move IDs deduplicate retries. Independent bubble moves and predictions from the same Guess Next round can arrive simultaneously; session and round identifiers prevent a delayed command moving into a subsequent game/round. Match status and session validity are checked on each action. Blocking or unmatching stops the next attempted move and closes both sockets; it is not an instantaneous safety-event subscription.

Client clocks display time only; server alarms settle timed results. Reloading reconnects and restores saved state. Four automatic connection retries precede an explicit Reconnect button. Closing the dialog disconnects its socket without abandoning the saved game. At most four sockets per user per room are accepted. Invites expire after 10 minutes; non-timed active games expire after 30 minutes. Inviting sends a notification through the existing preference-aware notification service.

## Deployment controls

- `SPIKEDATE_ARCADE_ENABLED=true` enables the live gateway; any other value disables it.
- `SPIKEDATE_ARCADE_BUBBLE_SECONDS` defaults to 45 and is bounded to 10–60 seconds. The dedicated local test configuration uses 10 seconds.
- `wrangler.stage.jsonc` now uses the wrapper and declares `ARCADE_ROOMS` / `ArcadeRoom` plus the `arcade-v1` SQLite class migration. Existing D1/R2 names are unchanged. There is no remote deployment in this implementation/testing task.
- `npm run dev` alone does not host the live Durable Object gateway. Use the built local Worker below for authenticated arcade testing.

## Repeatable local testing

Stop a previously running Wrangler session before rebuilding on Windows: its file watcher can lock `dist`. Existing Vite demo previews can remain running.

```powershell
npm run build:staging
npx wrangler d1 migrations apply DB --local --config wrangler.arcade-local.jsonc --persist-to outputs/qa/arcade/local-state
foreach ($fixture in @('maya','lena','imani','ava','noah','mateo','jordan','elias')) {
  npx wrangler r2 object put "spikedate-arcade-local-media/qa-fixtures/v1/$fixture.png" --local --config wrangler.arcade-local.jsonc --persist-to outputs/qa/arcade/local-state --file "public/$fixture.png"
}
npx wrangler dev --config wrangler.arcade-local.jsonc --port 3007 --persist-to outputs/qa/arcade/local-state --var SPIKEDATE_TEST_SEED_SECRET:arcade-local-test-only
```

In another terminal, provision the isolated 50 synthetic accounts and run the mobile suite:

```powershell
Invoke-RestMethod http://127.0.0.1:3007/api/test/seed -Method Post -Headers @{'x-spikedate-seed-secret'='arcade-local-test-only'}
$env:SPIKEDATE_UI_URL='http://127.0.0.1:3007'
$env:SPIKEDATE_QA_REPORT_DIR='outputs/qa/arcade/retest'
npx playwright test tests/playwright/arcade-live.spec.ts
```

Login helpers enter credentials through the actual app sign-in screen; assertions verify that the two browser contexts received distinct real server session cookies. Games are not localStorage simulations and WebSocket traffic is not mocked. Safety-test fixtures block test-001 against test-003 and test-004, so repeat the suite against a **fresh isolated persistence directory** (change `--persist-to` consistently for migrations, fixtures and the server). Do not reuse a tester's database or run this destructive safety suite on production. Local config credentials are public test-only values, not stage secrets.

Open the HTML report under the configured report directory for screenshots and individual test results. Physical-device Safari/Android, staging networking and notification delivery remain separate release checks.

After setup, `npm run arcade:local` starts the dedicated live local Worker and `npm run test:arcade:ui` runs this suite with a saved report. Remember to provision fresh isolated state for the blocking tests, as described above.

The live suite is gated to localhost port 3007; ordinary demo smoke runs and remote-stage runs skip it rather than trying to mutate their accounts.
