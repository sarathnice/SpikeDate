# B · Quiet Rail home

## Implemented

- Four vertically aligned, 44px profile actions: Pass, Like, Spike and Save. The Like heart is solid bright red; its outer control is clear with a thin outline.
- Today composer moved beside the existing global Boost control. Fresh Today updates moved to the upper-right area below the header; activity briefing remains available at upper left.
- Clear, unfrosted header and controls. Existing portraits, quality pipeline, cropping and theme accents are preserved.
- Home photos meet the bottom navigation without the liquid themes' previous floating-footer gap.
- Compact lower-left details: Inter 28px/500 name, 12px/400 supporting text, 11px/400 presence. Tags are reduced to the relationship intent on Home; other information remains in the full profile.
- Preview parity correction: light location-pin and relationship-heart icons accompany their text rows. The activity dot has a compact, explicitly visible style; the tonight moon uses the preview's light outline. Presence/tonight remain conditional on live privacy/activity and unexpired availability, never fabricated just to match a mockup.
- Today and tonight remain together below relationship intent, with no opaque background and a maximum two-line Today caption. The longer bio/prompt is condensed to one line when no Today/tonight is shown; the full content remains in the full profile.
- Own-profile preview uses the same four-action rail and separate Today controls. Preview actions remain non-mutating.

## Files

- `app/page.tsx`: separate profile actions from Today tools, add the scoped Quiet Rail home class. Existing callbacks are unchanged.
- `app/quiet-rail.css`: mobile layout/typography, theme-safe photo overlays, and narrow-screen logo sizing.
- `app/layout.tsx`: load the scoped stylesheet before legacy theme overrides.
- `tests/playwright/quiet-rail.spec.ts`: geometry across seven themes and 320/390/430px widths; dialogs, full-profile navigation, Pass, Save and simple Like.
- `tests/playwright/gallery-glass.spec.ts` and `profile-preview-controls.spec.ts`: update approved layout expectations while retaining behavior and own-preview no-send checks.

## Verification

Build, TypeScript, lint and all 114 unit/API tests passed. Formatting checks cover the changed application and test files.

Final mobile UI run: **12 passed, 0 failed**, covering both mobile projects. Results: `outputs/qa/quiet-rail-final/browser-report/index.html` and `playwright.json`. The Today/photo capture recheck also passed on both mobile projects (`outputs/qa/quiet-rail-photo-recheck`). Both projects use Chromium browser emulation, not native Safari or physical iOS/Android hardware.

Icon-parity follow-up: **12 passed, 0 failed** in `outputs/qa/quiet-rail-icons`. Location/intent icons are checked across all seven themes and 320/390/430px widths, including own previews. Isolated presence fixtures verify Online now, Active recently and hidden states; the unexpired tonight fixture verifies the moon. Build, TypeScript, lint, formatter and all 114 unit/API tests passed again.

The first run exposed the liquid-theme footer gap and an incomplete Today fixture that only seeded one profile. The footer was corrected and the isolated fixture now covers all 50 synthetic accounts. Final screenshots wait for image decoding and viewport repaint before capture.

The Like/Save and long Today/tonight case uses isolated API/storage fixtures: no allowance is spent and no real interaction or availability is created. Gallery and preview tests use local synthetic accounts; temporary prompt/presence changes are restored by the existing tests.

Actual local iPhone-sized screenshot: `outputs/home-quiet-rail-iphone.png`. Today fixture screenshots: `outputs/quiet-rail-today-ios-mobile.png` and `outputs/quiet-rail-today-android-mobile.png`.

Local server remains on http://127.0.0.1:3007/. No Git publishing or Cloudflare deployment was performed.
