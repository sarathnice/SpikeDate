# Chat A — Midnight Messages

Implemented locally on September 17, 2026. Cloudflare staging was not deployed.

## Approved design

- Midnight background `#10111B`, received bubbles `#1C1E2B`, outgoing bubbles `#E9E9EF` with dark text, coral accents `#FF805B`.
- Inter: inbox heading 29px/500, contact names 15px/500, messages 13px/400, previews 12px/400, timestamps 11px/400. Counts retain the user's lighter 300 weight.
- Quiet inbox dividers, searchable conversations, All/Unread filters, name-to-chat and avatar-to-profile navigation.
- Existing Games, Photo, Voice and Plan controls are grouped behind the composer’s + button. Existing plan cards, safety, Boost and messaging are retained.
- Chat uses A's approved midnight surfaces regardless of the selected app theme; other screens retain their existing theme.

## Verification

- 16 chat UI checks passed: eight on each Chromium-based iOS-sized and Android-sized project. Layouts checked at 320, 390, 430 and 1024px.
- Two separate synthetic logins proved UI message persistence and receipt by the matched recipient, on both mobile projects.
- Two live Four in a Row UI tests passed, including shared board, winner and reconnection through the new + menu.
- 99 unit/API tests passed. Formatter check, TypeScript, lint and staging-configured local build passed.
- Screenshots reviewed for the mobile conversation. Browser report: `outputs/qa/chat-midnight-final/browser-report/index.html`. Live-game report: `outputs/qa/chat-midnight-games/browser-report/index.html`.

## Failure fixed

The first Android send test exposed a race: incoming initial history replaced a just-sent optimistic message. The composer now waits for initial history, and stale chat-load responses are ignored. A delayed-history regression test passes on both mobile projects. A separate action-test selector was corrected to recognize the existing `Close Profile Lift` button; no application change was needed for that selector issue.

## Scope and limits

Modified `app/page.tsx`, `app/layout.tsx`, added `app/chat-midnight.css` and `tests/playwright/chat-midnight.spec.ts`, and updated the existing game UI tests for the + menu. No database schema, migration, Git publication or Cloudflare deployment was performed. Tests used the existing local synthetic profiles, not real accounts. UI checks use device-sized Chromium emulation, not physical iOS/Android devices. Existing photo/voice tool behavior was preserved; real media attachment capture and store payments are not newly implemented or certified by these tests.

## Repeat chat checks

Run the local runtime with `npm run arcade:local`, then in a separate PowerShell terminal:

```powershell
$env:SPIKEDATE_UI_URL='http://127.0.0.1:3007'
$env:SPIKEDATE_QA_REPORT_DIR='outputs/qa/chat-midnight-final'
npx playwright test tests/playwright/chat-midnight.spec.ts
```
