# Presence consistency

Historical report: superseded by [Live presence](LIVE_PRESENCE_QA.md), which adds
foreground heartbeats, Online now and a persisted privacy setting.

The app records recent authenticated API activity in `users.last_active_at`.
It does not currently track a live device connection. Previously Home said
“Online now”, Chat said “Active now”, and opening a conversation could force
the contact's activity to `true`.

## Changes

- One label: **Active recently**, meaning activity in the last 15 minutes.
- Discovery and conversations use the same timestamp helper and expiry rule.
- Server-backed UI uses timestamps, not sample-profile activity booleans.
- Missing, expired, invalid or future timestamps do not show an activity dot.
- Opening Chat does not manufacture recipient activity.
- Status expires on screen, checked every 30 seconds without a page reload.
- While Chat is visible, activity refreshes every minute and on window focus.
- Activity and “Available tonight” remain distinct: one describes app activity;
  the other is an explicit user choice, not a promise of availability to chat.

## Verification

- 70 unit/API tests passed, including recent-activity boundary/invalid-input tests.
- TypeScript, lint, formatter and the local staging-mode build passed.
- 8 mobile browser tests passed, 0 failed. They cover recent, expired and missing activity in Home,
  chat-list dots and chat headers; they also check in-session expiry and bounds.
- Separate browser checks read actual local database-backed discovery and
  conversation responses and verify timestamp-derived status.
- Device coverage uses iPhone 13 and Pixel 7 viewport emulation in Chromium/
  Edge, not physical devices or native Safari.
- The first expiry test installed the mocked clock after application timers
  already existed. Installing it before loading the page fixed the test setup.

Local app: <http://127.0.0.1:3007/>. No deployment or database migration.
Final browser report: `outputs/qa/presence-consistency-final/browser-report/index.html`.
