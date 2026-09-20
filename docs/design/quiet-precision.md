# Quiet Precision — approved typography

## Editorial Midnight adoption

The later approved Personal Editorial option A supersedes the profile and
registration roles below: full-profile names 26 px/500; own-profile names
24 px/500; profile captions and field labels 12 px/400, muted; profile answers
14 px/400; registration titles 22 px/500; fields 16 px/400. Full-profile content
uses 20 px side padding and section spacing; field labels use a 7 px gap,
inputs 12 px padding and 13 px corners. Interest labels are flat rather than
filled pills. Numbered uppercase own-profile captions and repeated details
are removed. Chat, navigation and notification roles remain unchanged.

`tests/qa/editorial-parity.cjs` directly compares 33 typography/spacing
properties against the selected Personal Editorial preview. The large photo
hero, current theme colors, complete eight-section editing, safety controls and
sticky profile actions intentionally remain rather than copying the illustrative
preview's photo crop or reducing available functionality. This is a documented
adaptation of A, not a pixel-identical replacement of the app with the mockup.

Follow-up verification exposed unwrapped text labels on later edit steps that
did not use `.field-label`. All `.field-grid label` captions now use 12 px/400
muted text, with field values explicitly using the primary text color. The
optional-details toggle is a quiet, transparent row and supporting descriptions
are muted. The mobile suite explicitly expands optional About-you fields and
validates every visible plain field label and caption/value color distinction
through all eight edit steps, rather than checking only decorated spans.

Option A, approved September 16, 2026. The implementation is in
`app/quiet-precision.css`, imported after the existing theme styles by
`app/layout.tsx`.

Use Inter for application UI. Keep the existing Poppins brand wordmark, logos,
colors, photography, action-icon shapes and navigation behavior. This is a
typography/spacing refinement, not a theme or functionality replacement.

| Role                                           | Size     | Weight |
| ---------------------------------------------- | -------- | ------ |
| Profile names, including home and card preview | 24 px    | 500    |
| Screen/dialog titles                           | 20 px    | 500    |
| Section headings and primary actions           | 14 px    | 500    |
| Profile answers and body copy                  | 13 px    | 400    |
| Field labels / option chips                    | 12.64 px | 400    |
| Notification option titles                     | 12.64 px | 500    |
| Supporting copy and counters                   | 12 px    | 400    |
| Navigation captions / compact annotations      | 11 px    | 400    |
| Active navigation caption                      | 11 px    | 500    |
| Editable fields                                | 16 px    | 400    |
| Chat message bubbles                           | 15 px    | 400    |
| Chat contact names                             | 16 px    | 500    |

Body line height is 1.6; chat messages and inputs use 1.5. Names use 1.25,
titles 1.3, and headings 1.4–1.45. Registration grids and full-profile sections
use a 17 px rhythm. Form controls and applicable primary actions use a 13 px
corner radius; circular action controls remain circular. Notification helper
copy stays smaller and lighter than option titles. Profile answers remain
regular even when marked up as `strong`.

The scoped important cascade layer bridges old theme-specific `!important`
rules without rewriting the legacy stylesheet. New typography rules belong in
this layer; do not add competing overrides to individual themes. Wordmark
descendants and the admin brand name are explicitly excluded from normalization.
Intentional icon-only zero-size labels and screen-reader text are not visible
caption violations.

## Verification

`tests/playwright/profile-typography.spec.ts` checks exact roles in create-account,
Profile/notifications, card preview, full-profile preview and registration/edit.
It exercises all six themes on iPhone/Pixel emulated Chromium configurations;
all eight edit sections are traversed in the default theme without saving.

`tests/qa/typography-inventory.cjs` inventories 28 screen states at seven viewport
sizes, checks document overflow and navigation bounds, and can enforce Inter,
normal style, weight 400/500 and a minimum 11 px visible UI size. Branding is
excluded. `tests/qa/typography-supplement.cjs` checks an existing match's chat and
the accessible admin landing, and captures images after they load. Opening a
conversation can mark existing messages read; neither script sends messages or
confirms purchases, registration saves, reports or invitations.

```powershell
$env:SPIKEDATE_UI_URL='https://spikedate-stage.sarathnice.workers.dev'
$env:SPIKEDATE_QA_REPORT_DIR='outputs/qa/quiet-precision'
$env:SPIKEDATE_TYPOGRAPHY_REPORT_DIR='outputs/qa/quiet-precision-inventory'
$env:SPIKEDATE_EXPECT_QUIET_PRECISION='true'
npx playwright test tests/playwright/profile-typography.spec.ts tests/playwright/mobile-flows.spec.ts --grep 'profile typography|Galaxy, Likes|discovery'
node tests/qa/typography-inventory.cjs
node tests/qa/typography-supplement.cjs
```

Run the inventory before the supplement so stabilized screenshots supersede
initial-load captures. Review JSON check results; failed checks also return a
failure exit code. This suite is targeted typography/navigation coverage, not every
functional scenario or formal accessibility certification. Physical devices,
Safari/WebKit, large system text, contrast over different photos, later plan
steps and protected admin operations need separate coverage. No production
deployment or database migration is part of this change.
