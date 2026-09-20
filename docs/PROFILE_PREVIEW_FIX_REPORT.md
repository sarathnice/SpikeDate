# Profile preview — Zoe and shared controls

Implemented locally on September 18, 2026. No Cloudflare deployment or Git publication was performed.

## Findings and fixes

- “My ideal first date includes going out…” came from the generated local test-profile prompt template, not Tonight availability or a generated date plan. Database-backed previews now hydrate saved prompt answers and interests; when no prompt is saved, the card uses the actual stored bio rather than a local template.
- Card preview omitted the home action rail. It now reuses the home controls in a six-button right-side column: Pass, Like, Spike, Save, Today and Fresh. These are non-sending preview controls with temporary explanatory feedback; they do not send Likes/Spikes, charge credits, save oneself or publish a Today post.
- Both card and full preview explicitly excluded activity status. Those exclusions were removed, and the preview now receives the real signed-in user ID to query live presence. Hidden activity preferences remain respected; Online is never fabricated.
- Preview-only CSS reserves space for the rail, keeps 44px targets, handles theme positioning overrides and separates the preview header from Boost.
- Photo audits found legacy stored objects without image MIME metadata. The media response now identifies known image signatures while preserving streamed bytes and all existing authorization/privacy checks. Unknown bytes remain octet-stream; filenames are not trusted.

## Verification

- Final main UI run: all 10 checks passed, five per iOS-sized/Android-sized Chromium project.
- Two additional theme checks passed for Gallery Glass and Liquid Lime, bringing the total to 12 passing UI checks. Both themes retain visible, non-overlapping right-side controls at 320px.
- Tested four synthetic accounts: Maya, Lena, Imani and Zoe. Zoe and Maya targeted checks covered widths 320, 390 and 430px; six visible, non-overlapping right-side controls; no interaction POSTs; saved prompt and actual-bio fallback; card/full live status; activity privacy off; full preview opening and closing.
- Photo audits verified stored photos download as image data, decode, use cover fitting, and render in card/full previews.
- All 114 unit/API checks passed, including eight new streamed MIME-fallback cases. TypeScript, lint, formatter check and staging-configured local build passed.
- Main browser report: `outputs/qa/profile-preview-final/browser-report/index.html`.
- Final additional theme-check report: `outputs/qa/profile-preview-theme-final/browser-report/index.html`.
- Initial failures comprised six repeated photo MIME failures and four incorrect test assertions expecting prompt text in the biography section. The media response was corrected and the test now separately checks biography and prompt text. All 10 main checks subsequently passed without retries.

## Files and limits

Changed `app/page.tsx`, `app/layout.tsx`, `app/api/media/[id]/route.ts`. Added `app/profile-preview.css`, `lib/media-response.ts`, `tests/media-response.test.ts`, `tests/playwright/profile-preview-controls.spec.ts` and this report. Unrelated workspace changes were preserved.

Tests use local synthetic profiles and Chromium mobile-sized emulation, not physical Safari/iPhone/Android devices. Temporary synthetic prompt and activity-preference changes are restored by the tests. Existing Today posts, availability and uploaded photos are not replaced. No database migration was needed.

Refresh http://127.0.0.1:3007/ to load the corrected preview.
