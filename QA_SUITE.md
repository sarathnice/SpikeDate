# Repeatable SpikeDate QA

Double-click `Run-SpikeDate-QA.cmd` on Windows to run the staging smoke suite and open its HTML report. Node 22.13+ and `npm ci` are required. Edge is used by default. This is a launcher, not a public admin button; it cannot expose test operations to app users.

## One command

```sh
npm run qa:stage
```

Smoke runs lint, TypeScript, unit/reporter tests, navigation, Today/save/Preview/reload, independent-session Like and chat/reply/read-receipt delivery, private-original/optimized-card photo checks, stored-photo/Preview audits for 3 synthetic accounts on both mobile sizes, and gallery upload/crop/drag/save tests. Upload coverage includes short mobile viewports, computer-size layouts, visible foreground progress, failure/retry, stored image variants, reload persistence and cleanup of the test photo.

```sh
# Full existing regression, build, cross-account delivery and 50 photo audits/device
npm run qa:stage -- --mode full
# Read-only profile/photo audit (except creating synthetic login sessions)
npm run qa:stage -- --mode photos --profiles 50
# Local test server must already be running with D1 and test fixtures
npm run qa -- --url http://127.0.0.1:3002 --mode full --open
# Optional one retry: reported as flaky, not as a clean pass
npm run qa:stage -- --retry
```

To use bundled Chromium instead of installed Edge, set `SPIKEDATE_PLAYWRIGHT_CHANNEL=bundled` and run `npx playwright install chromium` once.

After these changes are checked into GitHub, the manually triggered **SpikeDate staging QA** Actions workflow offers the same modes and uploads reports even on failure. It never deploys. Workflow execution has not been verified on GitHub yet; no files have been pushed by this task.

## Fixtures and safety

The suite expects existing `test001@spikedate.test` through `test050@spikedate.test` synthetic fixtures with verified, completed profiles. Missing accounts/photos fail visibly. It does not seed/reset tables or deploy. Only localhost and the exact approved staging host are accepted. Avoid running other testers against these fixtures simultaneously.

Smoke/full change synthetic Today/availability, filters, interactions and (full) mock subscriptions/media/safety actions. Existing interaction tests consume test entitlements; repeated runs may expose exhausted balances or fixture contamination. No automatic top-up/reset conceals this. The standalone legacy `tests/api-e2e.mjs` resets fixtures and is deliberately **not** invoked.

## Synthetic photo fixture maintenance

The September 16 smoke repair populated missing stored photos for the existing 50 synthetic accounts using eight shared sample portraits in `spikedate-media-stage/qa-fixtures/v1/`. These are test pictures, not 50 unique user portraits. Existing uploaded photos were preserved.

`node tests/qa/repair-stage-media.mjs` is an explicit staging-only maintenance operation, **not** part of a QA run. It uploads those sample objects and inserts primary photo records only for synthetic accounts without photos; it does not reset accounts. Future test seeding attaches these fixtures only when the corresponding R2 objects exist. Keep normal QA independent of maintenance so missing data remains a genuine failure.

## Reports

Every run creates `outputs/qa/<timestamp>-<pid>/index.html`, `summary.json`, step logs, Playwright HTML, JSON, JUnit and browser artifacts. `outputs/qa/latest.json` points to the most recent report. Failures include screenshots and traces; profile audits also attach successful Preview screenshots and inventories. Reports are ignored by Git and may contain synthetic chat/profile data: restrict access before sharing.

The exit code is 0 only for a clean pass. Failed, flaky, skipped/incomplete and runner errors return nonzero. Retries do not inflate scenario counts. A device-specific test case is counted separately from the same scenario on another device. The report never claims the entire application is covered.

## Coverage boundaries

Smoke/full also check the shared Inter typography on notification rows, profile cards, full-profile previews and profile editing. Each mobile project cycles through all six themes, verifies representative font sizes/weights and label/switch spacing, and attaches screenshots. These are two device-specific test cases with six theme iterations each, not twelve separately counted cases or pixel-diff baselines.

The typography checks now enforce the exact Daily Today idea style: Inter, normal, 12.64px, weight 400 throughout profile details and registration, including headings, helper text, option buttons and typing fields. They audit visible text elements, not only representative labels. They open all eight registration sections in Midnight on each mobile layout without submitting profile changes; the first edit section is checked in every theme.

Separate create-account typography cases audit the unauthenticated signup form, including mobile verification, email and password fields. They do not send SMS or create accounts. The wordmark is excluded from the shared text styling.

Own-profile Preview audits also verify keyboard and photo-tap opening of the full profile, decoded photos/current details, read-only self actions, closing back to the card and returning to Profile. Upload cases locate the uploaded photo by its saved ID and position in the full Preview carousel; the Today case verifies its text and tonight availability in the full Preview after reload. Gallery tests wait for stored media to load and confirm pre-existing media is preserved during cleanup.

Full includes existing phone-registration UI, discovery/full-profile actions, Like/Spike, navigation, Today, plan safety, verification sheets, subscription/Lift, upload/crop/cleanup, admin and Chloe filter recovery tests; a new independent-session check verifies Like persistence and recipient Incoming delivery. Photo audits download every stored photo for each tested fixture and verify the rendered primary Preview image, cover fitting and horizontal overflow.

Still to add: two-session match acceptance and unread-badge synchronization, cancellation/rejection matrix, every-theme screenshot baselines, interrupted saves, expiry via controlled clock, native-device keyboard/camera/push, actual SMS/payment-provider tests, and server ranking proof for Boost. Existing mocked/local flows are not evidence of real provider delivery. Do not label a green report production-ready.

To add a future feature test, create `tests/playwright/<feature>.spec.ts`; full mode automatically includes it. Put `profile audit` in its title only if it belongs in photo/smoke auditing. Keep writes restricted to synthetic accounts and corroborate optimistic UI changes with server/recipient observations.
