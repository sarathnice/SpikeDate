# SpikeDate staging smoke repair — September 16, 2026

## Scope and result

Target: https://spikedate-stage.sarathnice.workers.dev/

The corrected baseline had **2 passed, 10 failed** browser cases. Both post-fix smoke runs have **12 passed, 0 failed** each, with no retries or skipped cases. This is 12 distinct device-specific cases, executed twice, not 24 different scenarios.

Reports under `outputs/qa/`:

- Baseline: `2026-09-16T13-59-18-195Z-2772/index.html`
- Post-fix: `2026-09-16T14-19-48-816Z-20452/index.html`
- Fresh-session confirmation: `2026-09-16T14-21-50-293Z-10720/index.html`

## Root causes and fixes

| Failure                                      | Cause                                                                                                | Repair                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored-photo audits: 6 browser cases         | Synthetic accounts lacked D1 photo records/R2 objects; demo fallbacks concealed missing data.        | Uploaded eight existing shared synthetic sample portraits to staging R2 and inserted 49 missing primary photo records. Preserved the existing account photo. D1 confirms 50 synthetic accounts have stored photos. Future seeding checks that each referenced R2 object exists.           |
| Today/save/Preview: 2 browser cases          | Morning “Available tonight” used a window longer than the API's 18-hour maximum, returning HTTP 400. | Centralized the tonight window calculation, preserving 5 AM expiry while respecting the 18-hour limit. Added eight clock-boundary unit tests. Saving has a timeout and retains typed text on failure.                                                                                     |
| Cross-account Like delivery: 2 browser cases | Incoming read browser-local interactions instead of saved server interactions.                       | Added authenticated D1 Incoming retrieval, refresh on navigation and polling while Likes is open. Excludes blocked, declined and matched profiles; prioritizes Spikes. Returns public profile details and age, not email or birth date. Like-back and decline also persist to the server. |

The smoke assertions were not relaxed. Photo checks require stored image records, successful image responses, a decoded Preview photo, cover fitting and no horizontal overflow. Like delivery requires a separate recipient browser session.

## Verification

- Formatter run on changed source/tests.
- Lint and TypeScript: passed.
- Unit tests: 13 passed, including eight tonight-window boundary cases.
- QA reporter tests: 3 passed.
- Staging build: passed.
- Mobile smoke: 12 passed, 0 failed; iPhone 13 and Pixel 7 viewport/touch emulation in Chromium/Edge.
- Successful mobile Preview screenshots inspected; reports include profile inventories and recipient Incoming screenshots.
- Staging Worker version: `0e469a32-c417-426c-bde2-a965dc853476`, confirmed at 100% traffic.
- Database: D1 `spikedate-stage` (`ca142a34-ff1e-4772-8f86-8580c744b86a`); photo storage: R2 `spikedate-media-stage`.

## Limits and next steps

This is a smoke repair, not a production certification or a full 50-account cross-interaction audit. Three accounts were photo/Preview-tested on each mobile layout; the 50-account stored-photo count was separately checked in D1. Native iOS/Android hardware, actual SMS/payments/push, multi-session match/chat acceptance and Boost ranking require additional tests described in `QA_SUITE.md`.

Only staging was deployed. No production deployment, Git commit or push was performed by this repair. Existing unrelated worktree changes were preserved.

Repeat: `npm run qa:stage` or double-click `Run-SpikeDate-QA.cmd`.
