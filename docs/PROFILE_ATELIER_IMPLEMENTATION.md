# Option A — Quiet Atelier profiles

Implemented locally on September 18, 2026. Cloudflare staging and Git publication are unchanged.

## Changes

- Own profile: eight compact, directly editable categories with existing edit-section routing. Familiar Heart, Baby, Wine, User and discovery icons remain; Notebook and category-heading icons improve scanability. Long summaries are visually limited to two lines, with full details available in the existing editor.
- Removed redundant overview cards from the own-profile presentation; their information and edit actions remain available in category rows. Stored data and photos are not deleted.
- Compact, non-sticky profile navigation no longer covers the first category. Account tools are single-column grouped rows; notifications and connection reminders retain their existing expandable controls.
- Full profile: Looking For, Essentials, Family & Future, Everyday Life, story, prompt and interest sections. Essentials and lifestyle use four-column icon facts; two family facts use a balanced two-column row. Missing facts say “Not shared”.
- Category titles and content use regular Inter. Own row titles: 12.64px/400; summaries: 12px/400; full section labels: 11px/400; fact values: 12px/400; prose: 12.64px/400. Name headings retain the established larger 500-weight hierarchy.
- Theme-derived surfaces and readable icon colors replace conflicting legacy overrides. Photo galleries, Today, live-status privacy, Like, Spike, Save, Boost, subscriptions and safety behavior are preserved.

## Files

- `app/page.tsx`: category rows, section grouping and category icons.
- `app/profile-atelier.css`: scoped Option A presentation.
- `app/layout.tsx`: imports the scoped stylesheet.
- `tests/playwright/profile-atelier.spec.ts`: all category edit destinations, seven themes, mobile geometry and computed typography.
- `tests/playwright/profile-typography.spec.ts`: updated profile typography assertions and opens collapsed settings before inspecting them.
- `tests/playwright/gallery-glass.spec.ts`: selects the first grouped fact grid for its screenshot.

## Verification

- Unit/API tests: 114 passed in 16 files.
- TypeScript, lint and formatting passed.
- First mobile run: 18 passed. Subsequent typography checks exposed an older opacity override, corrected in the scoped stylesheet. Screenshot review also prompted compact navigation and reduced legacy section padding.
- Final rebuilt mobile run: **22 passed, 0 failed**, without retries. Separate Gallery Glass regression run: **2 passed, 0 failed**. Total: **24 passing UI tests** across iOS-/Android-sized Chromium projects.
- The category checks covered all seven themes at 320px and 430px, all eight edit destinations, single-column account tools, icon visibility, computed font roles and non-overflowing full-profile fact grids. Registration/edit typography checks also passed across six themes and eight edit sections.
- Photo, notification-switch, presence/privacy and non-sending profile-preview checks passed. Gallery regression verified the Spike composer and Boost open/close behavior.
- Final local staging-configured build passed. No deployment was performed.
- Main browser report: `outputs/qa/profile-atelier/final-tested/browser-report/index.html`.
- Gallery regression report: `outputs/qa/profile-atelier/gallery-regression/browser-report/index.html`.

Testing uses synthetic local accounts and Chromium with iOS-/Android-sized emulation, not physical phones or Safari. No Cloudflare deployment, database migration or photo replacement is part of this change.
