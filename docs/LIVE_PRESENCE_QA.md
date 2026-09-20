# Live presence

## Implemented locally

- A visible, connected app sends an authenticated heartbeat every 30 seconds.
- Each browser tab uses a unique client ID, scoped to its signed-in session.
- A server-timed heartbeat grants a 90-second online lease. Clients cannot set
  their own timestamp. Repeated writes within 15 seconds are throttled.
- Visible profile and Chat indicators refresh in batches every 15 seconds;
  on-screen expiry is checked every 5 seconds.
- Home, full profiles, chat-list dots and chat headers share one status component.
- Backgrounding or leaving sends a best-effort leave request for that tab only.
  A lost connection expires automatically even if the leave request never arrives.
- A second active tab/device keeps the person online. Revoked or expired sessions
  cannot keep them online.
- Profile → App & Account → **Show my activity status** persists the privacy choice.
  Turning it off hides both Online now and Active recently and clears all of the
  user's online leases. Server checks also suppress other devices' heartbeats.
- Blocked, unknown and non-discoverable unmatched profiles do not reveal presence.
- Available tonight remains a separate, voluntary user choice.

## Status example

Maya views Lena's profile or conversation:

1. Lena has the app visible and connected: **Online now**.
2. Lena backgrounds all tabs: **Active recently** after the leave signal is read.
3. If Lena loses connectivity, **Online now** expires within 90 seconds of the
   last heartbeat; observer polling can add up to 15 seconds before it is noticed.
4. After 15 minutes without recorded app activity, the activity indicator disappears.
5. If Lena hides activity, neither the live nor recent activity indicator is shown.

Online status is an approximate connection indicator, not proof of attention,
message delivery, personal safety or willingness to meet.

## Verification

- Final mobile run: **14 passed, 0 failed**, across iPhone and Android viewports
  (6.4 minutes). Includes 4 multi-user live-presence tests, 8 consistency/API
  regression tests and 2 communication-settings regression tests.
- 81 unit/API tests passed, including 9 SQLite-backed presence endpoint tests
  and 4 shared presence helper tests.
- Formatter, type check, lint and staging-mode build passed locally.
- Mobile tests use separate signed-in synthetic Maya/Lena browser sessions.
- Lifecycle coverage includes privacy persistence, full-profile status,
  multiple tabs, background/foreground transitions, logout and real server-time
  expiry after disconnecting the sender's browser network.
- Recent/missing/expired activity and communication settings are regression-tested.
- Mobile viewports are iPhone 13 and Pixel 7 using Chromium/Edge; this is not
  physical iOS/Android or native Safari testing. Visibility transitions are
  simulated with the browser's visibility-change event; network loss is imposed
  using the browser context's offline mode.
- An initial test selector expected exactly “Chat”, but Maya's unread badge made
  its accessible name “Chat [count]”. The test now accepts the count; no app
  navigation change was required.

## Database and files

New local tables: `live_presence` (session, tab ID, heartbeat timestamp) and
`presence_preferences` (user ID, visibility setting).

Migration: `drizzle/0007_flippant_forgotten_one.sql`, generated from `db/schema.ts`,
with updated Drizzle journal and snapshot. Applied only to the local QA database.
The existing staging deployment must receive this migration before the new app
code is deployed there.

Key code: `app/api/presence/route.ts`, `components/live-presence.tsx`,
`components/presence-status.tsx`, `lib/presence.ts`, `lib/server/auth.ts`,
discovery/conversation endpoints and `app/page.tsx`.

Run the focused suite:

```powershell
$env:SPIKEDATE_UI_URL='http://127.0.0.1:3007'
npx playwright test tests/playwright/live-presence.spec.ts tests/playwright/presence-consistency.spec.ts tests/playwright/communication-settings.spec.ts
```

Local app: <http://127.0.0.1:3007/>. Cloudflare staging has not been changed.

Final browser report: `outputs/qa/live-presence-final/browser-report/index.html`.
JSON/JUnit results are in the same report directory. The two connection-loss
tests attach the initial online lease and expired server response as JSON.
Tested screenshots: `outputs/qa/live-presence/examples/online-ios-mobile.png`,
`recent-ios-mobile.png`, `online-android-mobile.png`, `recent-android-mobile.png`.
