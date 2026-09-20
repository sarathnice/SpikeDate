# Like and Spike allowance protection

Implemented locally, September 17, 2026. Cloudflare staging and Git publication are not included.

## Rules

| Existing connection | New action | Result |
| --- | --- | --- |
| Like | Like | Already liked; no additional allowance deducted or notification |
| Like | Spike | Explicit `Upgrade to Spike · uses 1 Spike` confirmation; original entry updated |
| Spike | Like | No downgrade, additional deduction or notification |
| Spike | Spike | Already sent; no additional deduction or notification |
| Active match | Like or Spike | Open Chat; no additional deduction |

Home and full-profile views can show a small Liked/Spike sent state. Already-sent Spike composer buttons are disabled. Like remains a one-tap action with no note. Unmatched Today replies open the Spike composer for review rather than silently sending an introduction as a Like. Existing server discovery queries exclude acted-on profiles.

## Implementation

- `lib/server/protected-send.ts`: conditional SQL mutations, D1 atomic batch covering send/upgrade, Spike ledger/debit, match and conversation creation. Database guards prevent repeat sends with different request IDs and overspending the last Spike. No new database tables or migrations.
- `app/api/interactions/route.ts`: protected positive sends, explicit upgrade input, retry responses including the actual wallet balance, outgoing connection/profile/media data with blocked users excluded.
- `app/page.tsx`: server-confirmed allowance changes; a synchronous send lock and disabled sending controls; stable request IDs retained for retries; sent state restored from server data; a database-backed You liked list; upgrades and active-match Chat routing. Voice confirmations now open the Spike composer instead of bypassing review and spending locally. Like-back also waits for confirmation.
- `app/globals.css`: lightweight sent-state typography.
- `tests/protected-send.test.ts`: nine isolated SQLite tests, including failed-transaction rollback, last-credit competition and notification delivery failure.
- `tests/playwright/protected-send.spec.ts`: mobile UI, separate recipient login, and actual local D1 concurrent-request testing.

Spike balance is server-authoritative. The existing free daily-Like counter remains client-managed; this change protects it from duplicate/failed sends, but does not introduce a new cross-device daily-quota service. Purchase/refund history is not rewritten, and previous duplicate charges are not automatically refunded.

## Verification

- Unit/API suite: 68 passed, including nine new protection cases.
- Formatter, TypeScript, linter and local Cloudflare-compatible build checked.
- Protection UI/API test retest: four passed on iPhone 13 and Pixel 7 browser-emulated settings. Actual physical iOS/Android devices were not used.
- Final combined regression run: 12 passed, 0 failed (four protection tests, four registration tests, two compact-photo tests and two Galaxy tests); final TypeScript and lint checks also passed.
- Confirmed failure leaves the Like counter unchanged, retry reuses the request ID, upgrade charges one Spike, repeat Spike button is disabled, duplicate API sends do not charge, and a separate recipient sees one incoming Spike.
- Three concurrent actual local D1 sends returned one 201 and two duplicate 200 responses, with one credit deducted.
- Initial test failures: two test assertions omitted zero padding from synthetic user IDs; one fixture was not connection-ready. Corrected the assertions and used connection-ready synthetic fixtures; retest passed. These were test/fixture issues, not duplicate charging failures.

Reports: `outputs/qa/protected-send-retest/browser-report/index.html` and final regression report `outputs/qa/protected-send-verified/browser-report/index.html`.

Tests mutate only the isolated local `spikedate-arcade-local` database and synthetic accounts. Fresh-send tests refuse non-loopback URLs, check fixture readiness and replenish synthetic credits through the existing mock weekly-subscription purchase endpoint if needed; this can activate a mock Plus subscription on the test account. No money is charged. A final-build attempt using synthetic account 050 was correctly rejected because it was not connection-ready; fixture preparation now uses verified accounts 048/049 and checks readiness before sending. No real purchases/SMS or Cloudflare staging data were changed.

One repeated Android fixture run produced an actual mutual match, which correctly opened Chat instead of the expected unmatched Spike composer. The upgrade test now excludes incoming likers and existing matches when choosing its recipient. The local credit-fixture tests are skipped on non-local URLs instead of changing stage/production accounts.

A text-based test selector for the profile name Sage also matched the word Message in another row. It was corrected to select the exact profile-name button; this was a test-selector failure, not an application send failure.
