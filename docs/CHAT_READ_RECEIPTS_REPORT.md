# Spike Midnight — unread styling and read receipts

Implemented locally on September 18, 2026. Cloudflare staging is unchanged.

## Behavior

- Unread badges use pale red `#FFC2C7` with dark numbers; unread previews and inbox totals use the same pale red against midnight. Numeric weight remains 300.
- A 3px, 45%-opacity white scroll thumb appears only when history overflows, with no bulky track. It follows scrolling and cannot block taps.
- Loading message history no longer marks messages read. The visible-tab UI acknowledges selected incoming messages after 600ms of settled visibility, with a minimum visible portion and an overlay hit check.
- The API accepts up to 80 message IDs, verifies conversation membership, and updates only incoming, nondeleted messages in that conversation. Repeated acknowledgements keep the original timestamp.
- The sender displays one `Read · time` receipt when the latest outgoing message has a server read timestamp. Persisted messages otherwise show `Sent`; unconfirmed local drafts show `Not confirmed`.
- Open, visible conversations refresh history and receipts every five seconds. Inbox previews/counts refresh every five seconds in Chat and every fifteen seconds elsewhere. Hidden tabs skip this polling.
- Sending a message does not clear unread incoming messages. Locally removed messages remain hidden when history refreshes.

## Verification

- Final mobile UI run: all 20 checks passed, 10 each on iOS-sized and Android-sized Chromium projects, with no failures or retries.
- 106 unit/API checks passed, including seven new read-receipt API cases. The final 80-ID limit was also rechecked with those seven API cases.
- Formatter check, TypeScript, lint and staging-configured local build passed.
- Mobile UI results: `outputs/qa/chat-read-final/browser-report/index.html`.
- Two-account scenarios cover read-only fetching, offscreen messages, visible-message acknowledgements, simulated hidden-tab behavior, pale-red unread badge color, the narrow scroll indicator and a sender receipt updating without reopening.
- Existing chat regressions cover widths 320/390/430/1024px, messaging, delayed initial history, games/tools navigation, safety/Boost/plan dialogs and short-height composer layout.
- The initial iOS-sized run exposed stale inbox counts after messages arrived following login. Visible-tab conversation-count refreshes fixed this; the iOS-sized receipt scenario subsequently passed.

## Scope and limits

Modified `app/page.tsx`, `app/chat-midnight.css`, and `app/api/conversations/[id]/messages/route.ts`. Added `tests/chat-read-api.test.ts`, `tests/playwright/chat-read-receipts.spec.ts`, and this report. No database schema migration, Git publication or Cloudflare deployment was performed.

Tests use local synthetic accounts and Chromium device-sized emulation, not physical iOS/Safari or Android devices. A read receipt means the client acknowledged displaying the message, not proof of human attention. Existing historical read timestamps are retained. History remains capped at 200 messages per fetch, now selecting the latest 200; older-history pagination is not implemented in this change.

Refresh http://127.0.0.1:3007/ to load the rebuilt application.
