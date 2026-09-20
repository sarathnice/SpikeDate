# Connection details and local profile reset

September 18, 2026. Local development only; no Cloudflare staging/production deployment or Git push.

## Delivered

- Optional **How we connect** card in registration's Connection stage: relationship style and up to three personal values. No additional mandatory signup screen.
- Profile → Connection editor: style, values, dating pace, communication preference, everyday rhythm and languages. Rhythm choices cannot select conflicting morning/night or weekend answers. Blank answers remain unshared, not incompatibilities.
- Persistent `profile_connections` table through migration `0008_profile_connection.sql`. Values are separate from hobbies; no scientific compatibility score or mandatory exclusion is introduced.
- Full profile/own preview: subtle icons, light labels, regular content, two-column connection summary. Profiles opened through matched/chat paths also retrieve approved gallery entries, prompts, interests and declared public facts after access/block checks. Birth date, email, phone and exact location are not returned in this public response.
- Seventeen optional conversation starters, including “A little thing that makes me feel cared for…”.
- Discovery displays stored interests and prompts rather than inherited sample text.

## Explicitly approved deletion and recovery

The user approved deleting all 85 accounts in local `spikedate-arcade-local`. The local server was stopped and the entire persisted D1/R2 state copied to:

`outputs/qa/backups/pre-connection-reset-20260918/local-state`

The local-only delete removed all 85 user rows and cascading profile/session/social records. Queries confirmed zero users, zero profiles and zero sessions immediately afterward. Cloudflare D1/R2 was not modified. Existing local R2 objects were retained, including orphaned former uploads; they are no longer referenced by a live profile. The complete backup provides a recovery copy. Do not merge its old database into a running new environment; stop the server and deliberately choose a full restore if needed.

## New test set

60 deliberately synthetic profiles: 30 women, 30 men. Accounts `test001@spikedate.test` through `test060@spikedate.test`, local test password `SpikeDate2026!`. Each has a connection record, two prompt answers, lifestyle/family/education fields, three interests and three ordered gallery records. Local inventory after provisioning: 60 users, 60 connections, 120 prompts and 180 photo records.

The galleries reuse eight existing sample portrait assets (four per gender) and repeat each assigned sample across its three positions. These are **not 60 unique identities or three distinct photos per person**. They exercise gallery ordering/navigation and authenticated media delivery. Fixture phone/photo verification flags are synthetic provisioning, not real SMS, identity checks or registration completion. Separate UI tests exercise actual account registration against the local mock phone provider and private safety-camera flow.

A previous browser session belongs to a deleted account/session. Refresh, sign out if necessary, and sign in again using the new test picker. Per-device unsaved caches are not database proof; the tests use clean independent browser contexts.

## Verification

Initial feature tests: six passed, two failed due to an incorrectly scoped test locator for the separate Like rail. The locator was corrected. Final targeted mobile regression: **34 passed, 0 failed, 0 skipped, 0 flaky** across iPhone and Android viewport emulation, including connection details, registration, photo upload/framing, own preview, Quiet Rail, mobile flows and cross-account checks. The Playwright JSON/JUnit results are in `outputs/qa/connection-profiles/features-final/`. TypeScript, lint and unit/API checks are run separately so a later command cannot hide an earlier failure.

Reports and screenshots live under `outputs/qa/connection-profiles/`. Mobile runs use Edge Chromium device/viewport emulation, not physical Safari/iOS/Android hardware. Camera streams and SMS are local synthetic/mock fixtures. No paid Cloudflare Images optimization is enabled.
