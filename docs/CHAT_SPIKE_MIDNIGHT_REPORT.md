# A3 — Spike Midnight

Implemented locally on September 18, 2026. This supersedes the earlier Midnight Messages conversation layout.

## Implemented

- Compact header with profile photo, live-presence text, back, safety menu and Boost.
- Midnight background `#10111B`, received bubbles `#272936`, outgoing bubbles `#E9E9EF`, coral accent `#FF805B`.
- Inter message text: 14px, regular 400 weight, 1.4 line height. Consecutive messages are grouped with reduced spacing.
- Only message history scrolls. No wide visible scrollbar or bottom navigation inside a conversation; inbox navigation returns on Back.
- Bottom composer adapts to available viewport height, with a rounded focus ring and existing Games, Photo, Voice and Plan tools behind +.
- One Sent status beneath the last outgoing message, rather than repeated status/action rows.
- Outgoing message actions open on tap. “Remove from this view” is explicitly local-only and does not recall the recipient’s copy.

## Verification

- 18 chat UI checks passed, across Chromium-based iOS-sized and Android-sized projects. Tested widths: 320, 390, 430 and 1024px.
- Verified two separate logins send and receive persisted messages, delayed initial-history protection, long-history scrolling, grouped messages, menu behavior and navigation.
- Final rebuilt application: two compact-chat rechecks and two live Four in a Row checks passed, including shared board, winner and reconnect.
- Short-height 390 × 480 viewport checks passed for composer visibility. This is viewport simulation, not a physical keyboard test.
- 99 unit/API tests passed. Formatter, TypeScript, lint and staging-configured local build passed.
- Final mobile screenshot reviewed: `outputs/spike-midnight-ios-mobile.png`.
- Reports: `outputs/qa/spike-midnight-compact/browser-report/index.html` and `outputs/qa/spike-midnight-final/browser-report/index.html`.

## Files and scope

Changed `app/page.tsx`, `app/chat-midnight.css`, `tests/playwright/chat-midnight.spec.ts`; added `tests/playwright/spike-midnight-compact.spec.ts` and this report. Existing unrelated workspace changes were preserved.

The application remains running at http://127.0.0.1:3007/. Refresh the browser to load the new build. No database migration, Git publication or Cloudflare deployment was performed. Tests used local synthetic accounts. Physical iOS/Safari and Android testing, real media capture and payments are not certified by this run.
