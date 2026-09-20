# Mobile Likes and Chat list polish

## Changes

- Likes: search by name across the incoming, sent, matched and saved views; existing free/Plus visibility limits remain unchanged.
- Heart, send and connection icons on Likes tabs; Spike and message icons on filters; explicit pass/accept/message icons on actions.
- Removed the redundant incoming “New” filter, which had no unread/new data behind it, and index-based verification badges. No verification status is fabricated.
- Chat: conversation and unread filter icons, with an All conversation count. Existing unread-message totals, pale-red unread styling, presence, search and read receipts are preserved.
- Compact 48px portraits, 14px/500 names, 12px/400 supporting copy, restrained dividers and 44px Likes action targets. Changes are scoped to lists; conversation styling and send behavior are unchanged.

## Verification scope

`tests/playwright/connections-polish.spec.ts` exercises 50 incoming likes and 50 conversations with isolated API-response fixtures, including 25 unread conversations containing 12 unread messages each. These are volume fixtures, not new database profiles. The test covers name search, empty results, Spike filtering, unread filtering, scrolling to the last row, 320/390/430px widths, and seven Likes themes. It performs no purchases, likes, passes or message sends.

A separate case uses an actual local synthetic account to check all Likes tabs and opening Lena’s conversation. The existing Chat inbox regression is also included. iOS-sized and Android-sized projects use Chromium emulation, not native Safari or physical devices.

Run locally:

```powershell
$env:SPIKEDATE_UI_URL='http://127.0.0.1:3007'
$env:SPIKEDATE_QA_REPORT_DIR='outputs/qa/connections-final'
npx playwright test tests/playwright/connections-polish.spec.ts tests/playwright/chat-midnight.spec.ts --grep 'Mobile connection|Real local|A inbox'
```

Build, TypeScript, lint, formatting and all 114 unit/API tests passed. An initial inbox regression expected the button’s old exact accessible name “All”; its selector was updated to accommodate the new visible conversation count. Final UI results are in `outputs/qa/connections-final/browser-report/index.html` and `playwright.json`.

Final mobile UI result: **6 passed, 0 failed**, across iOS-sized and Android-sized Chromium projects (57.6 seconds). All six changed code/test/document files passed formatting checks.

Cloudflare staging is unchanged. Local app: http://127.0.0.1:3007/.
