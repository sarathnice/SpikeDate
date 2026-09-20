# Arcade implementation and live QA

Date: September 17, 2026. Environment: isolated local Cloudflare Worker at `http://127.0.0.1:3007`, using real local D1/R2 and SQLite Durable Objects. No deployment, stage migration, Git commit or push was performed.

## Delivered

Chat → Play Together now separates ten Conversation games from three live Arcade games: Four in a Row, Bubble Duel and Guess Next. Only authenticated participants of an active accepted-match conversation can play. The invitee must accept. Leave/decline do not end the match. Boards, turns, scores, predictions and results are controlled and persisted on the server, not simulated by the browser.

Modified/new files for this iteration: `lib/arcade.ts`, `lib/server/arcade-room.ts`, `workers/stage-entry.js`, `components/arcade-games.tsx`, `components/dating-games.tsx`, `app/games.css`, the server-mode contacts initializer in `app/page.tsx`, both Wrangler configurations, package scripts, `tests/arcade.test.ts`, `tests/playwright/arcade-live.spec.ts`, README and game documentation. Generated assets are actual browser screenshots/reports and the dry-run Worker bundle; no AI mockups or new branding assets were used. Unrelated pre-existing working-tree changes were preserved.

## Verification

Final full run: **14 passed, 0 failed, 0 skipped** (approximately 3.9 minutes). All **55 unit/API tests passed**, including 15 arcade engine tests. Type checking, lint, build and Cloudflare deployment dry-run passed. Initial failures below were resolved before this clean full rerun.

Browser results and screenshots: `outputs/qa/arcade/complete-run/browser-report/index.html`. Machine-readable results: `outputs/qa/arcade/complete-run/playwright.json` and `junit.xml`. These generated artifacts are ignored by Git.

The suite creates independent browser contexts, signs in through the real UI and checks distinct HttpOnly server-session cookies. It does not mock authentication, game APIs, WebSockets or game state.

| Scenario                | Checks                                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Four in a Row           | Invite, accept, disabled out-of-turn button, seven actual moves, same live board on both clients, recipient reload after move two, restored game, matching winner, final board visible                                      |
| Bubble Duel             | Same starting board, actual bubble pop, sender score and recipient opponent score change without refreshing, authoritative timeout, same winner on both screens                                                             |
| Guess Next              | Five rounds, locked choice cannot be changed, no reveal before partner prediction, both clients see the same reveals, total scores, final result, decline, leave and match retained                                         |
| Gateway access          | Non-WebSocket request rejected, unsigned handshake rejected, signed-in third account rejected for another pair's conversation                                                                                               |
| Server rule enforcement | Forged out-of-turn move rejected, valid move delivered, stale revision rejected, invalid column rejected, rejected moves leave board unchanged, simultaneous predictions complete one shared round                          |
| Safety                  | Separate pair starts game; recipient blocks; next attempted move closes both live sockets; conversation disappears from recipient's active matches                                                                          |
| Conversation regression | Ten games remain available, This or That invitation accepted by a separate authenticated user, three private rounds, early API reads hide partner answer, both clients reveal only after both submit, both reach completion |

Each scenario runs on iPhone-sized and Pixel-sized Chromium/Edge browser projects. These are mobile viewport/touch emulations, **not physical-device Safari or native Android testing**. Four distinct synthetic accounts are used (Maya/test-001, Lena/test-002, Imani/test-003, Ava/test-004), drawn from 50 isolated synthetic profiles; all 50 have approved fixture photos, using eight reused sample portraits. This is not an assertion that all 50 accounts completed every game.

Unit/API suite covers 55 tests in seven files, including 15 new pure arcade-rule tests: wins in all four directions, draw, full columns, illegal coordinates, acceptance authority, strangers, stale and duplicate moves, private predictions, simultaneous same-round moves, old-round rejection, bubble connectivity, independent boards, score calculation, timeouts, decline/leave and expiry.

TypeScript (`npx tsc --noEmit`), lint (`npx oxlint`), formatting of changed files, staging-mode web build and `wrangler deploy --dry-run --config wrangler.stage.jsonc` are additional checks. Dry-run bundles the Worker and verifies the declared bindings without deploying.

## Initial failures and fixes

- First iPhone-sized run: 2 passed / 2 failed. Real application bug: server-mode contacts initially contained demo rows, allowing a fast navigation after reload to open a contact without its database conversation ID. Server mode now initializes contacts as empty until the real list arrives. Bubble Duel comparison was a test synchronization problem: it read one player's board before that client's acceptance update rendered. The test now waits for both 30-cell boards.
- Expanded run: 11 passed / 1 failed. Android harness double-clicked Leave while the first action was still being acknowledged, then waited on a removed control. The harness now waits for the completed leave state before inviting the next game.
- Added-regression run: 13 passed / 1 failed. The Android Conversation test correctly reopened the completed game from the previous iPhone-sized run but expected the catalogue immediately. The harness now uses Browse games before a new invitation. Both Conversation regression retests passed.
- Raw-protocol tests now ignore presence-only snapshots when waiting for a move acknowledgement. This avoids mistaking a connection-presence broadcast for a successful mutation.
- A unit-test fixture previously created two different sessions when testing Leave; it now uses one session consistently. A Windows build hit a generated-output file lock while Wrangler watched `dist`; stopping that local Worker before rebuilding resolved it.
- Additional implementation safeguards: final board retained, four-socket-per-user cap, session/round identifiers for delayed commands, independent simultaneous prediction/bubble handling, bounded round duration, preference-aware invitations, and no Conversation polling while the live Arcade tab is open.

## Release follow-ups

Staging is unchanged. Its config is prepared with the wrapper Worker, `ARCADE_ROOMS` binding and the `arcade-v1` SQLite class migration. Approval/deployment should be followed by two-account staging checks, physical iOS Safari/Android checks, notification-device delivery testing, measured latency/cost under load, accessibility screen-reader checks and user feedback on board animation/pacing. Games have no wagering, paid advantages or scientific compatibility scores. Chess, a game invitation inbox/deep-link UI and game-specific reporting/admin history are future work.

Safety closure is checked on the next attempted game action; it is not a push subscription to every block/unmatch event. Invitations expire after 10 minutes and active non-timed games after 30 minutes. Bubble Duel uses 45 seconds normally and 10 seconds in the dedicated local QA configuration. Use fresh isolated fixture state when repeating the safety suite; see [setup instructions](ARCADE_GAMES.md).
