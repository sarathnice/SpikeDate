# Compact profile controls

Changes:

- Own-profile photos now use one 48 × 64 px thumbnail row instead of a three-column/two-row grid. The row scrolls horizontally when needed; keyboard focus on a thumbnail also brings it into view. Photo editing remains available from each thumbnail and the Edit photos button.
- Notifications and Connection reminders are separate native disclosure sections, closed initially. Their headings support touch, mouse and keyboard expansion. Closing a section does not change its preferences.
- Removed the switch thumb's duplicate CSS translate, which was combining with the custom transform and moving checked knobs outside their tracks. Fixed the extra notification-switch thumb margin, constrained text columns, and allowed the reminder-time row to wrap on narrow screens.

Verification target: http://127.0.0.1:3007/ (isolated local Worker/D1/R2). No staging deployment or production data changes.

Regression suite:

- `tests/playwright/compact-profile.spec.ts`: UI-only six-photo response fixture, single-row layout at 320/390/412 px, horizontal overflow and last-thumbnail visibility on a narrow phone, Edit photos navigation, and Tonight switch containment in both states.
- `tests/playwright/communication-settings.spec.ts`: both sections initially closed, expansion/collapse and keyboard access, all ten preference switches toggled in both directions with track/row/viewport containment checks at 320 px, and restoration of original preferences.

Final mobile-browser results: 4 passed, 0 failed across iOS-sized and Android-sized Chromium/Edge projects. Initial tests reproduced the overflowing switch thumb; both failures passed after the fix. These are browser emulations, not physical iPhone/Safari or Android device runs.

An additional two photo-row checks passed after requiring all six thumbnail images to finish loading, rather than capturing loading placeholders. That report is in `outputs/qa/compact-profile/photo-load/browser-report/index.html`.

Also passed: TypeScript, lint, staging-mode build, and all 55 unit/API tests. Final browser report: `outputs/qa/compact-profile/retest/browser-report/index.html`.
