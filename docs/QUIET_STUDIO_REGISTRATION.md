# Quiet Studio registration and profile photography

Implemented locally on September 18, 2026. Cloudflare staging is not redeployed by this change. No Git commit/push, production mutation, schema migration, or paid-service activation is included.

## Setup and optional depth

Keep five profile stages: basics, connection, photos, vibe, and review. Account mobile verification, adult birthday, gender, password rules and terms remain enforced separately.

The optional Vibe stage includes two collapsed cards:

- Life & lifestyle: education, have children, want children, drinking, and smoking. Blank answers remain unshared; family status and future family plans are separate. Prefer not to say is available.
- Your personality: About me (300 characters), music/travel interests (five interests overall), and a second selectable conversation starter with suggested Sunday/travel answers. Sixteen starter questions are available; answers are personal choices, not auto-published suggestions.

The review includes both prompts, bio and provided lifestyle facts. Existing profile editors support the new choices and questions. Data uses existing `profiles`, `profile_prompts`, `interests` and `user_interests` tables. No new table is needed. Closing/reopening onboarding restores its per-account draft; successful completion clears the draft. Background profile hydration must not discard in-progress edits or close a camera/crop.

Quiet Studio typography: Inter, regular 400 labels/body/fields; 500 headings and main actions. Onboarding titles are 21px, labels 12px and editable controls 16px. Create-account title is 23px. Actions remain outside the scrolling onboarding body. Extra paragraphs and large vertical answer tiles are reduced; important validation and privacy information remains visible. Theme palettes and existing brand assets are retained.

## Profile photo versus safety capture

`Take a profile photo` is available in onboarding Photos and the existing Preferences & media editor while fewer than six photos exist. Flow: explicit Start camera → Capture photo → Retake / Use photo → existing framing editor → Save photo → existing authenticated media API and R2. The camera requests no audio and captures native video dimensions rather than a low-resolution verification thumbnail. Only the live preview is mirrored; saved pixels retain real camera orientation. Closing, hiding the page, or receiving late permission responses stops camera tracks. Closing discards the temporary capture.

The separate safety-camera flow stays private: on-device face/quality analysis and capture digest/status only; no selfie is automatically published. It is not liveness, identity proof or photo matching. A camera quality check does not issue a verified badge. New-profile discoverability remains gated by the existing verification/moderation rules.

## Face-aware cinematic framing

The photo editor provides explicit `Find faces for framing` assistance with disclosure. Detection runs locally using the existing bundled MediaPipe detector/model. A single detected face produces a suggested frame; multiple faces appear on the original with selectable face boxes. Choosing a face guides the crop toward that person with headroom where source bounds allow. Manual drag/zoom and exact profile, discovery and avatar previews remain available. Detection errors/no-face results do not prevent manual saving. No facial embeddings or identity decision are produced.

Preserved originals and existing three-crop export pipeline remain unchanged. Natural is the default; Gentle light is opt-in and capped at +6%. No face reshaping or generative filters are applied. Source-limited output is not artificially enlarged. Public canvas-derived variants do not carry the original file's EXIF metadata; the preserved owner-only original may retain EXIF, including GPS. Original retention policy remains a separate operational decision.

## Cloudflare-ready delivery, disabled by default

Existing staging resources: Worker `spikedate-stage`, D1 `spikedate-stage`, R2 `spikedate-media-stage`. The authenticated media GET route can optionally optimize already-selected R2 crop bytes through `IMAGES`, with bounded variant widths, negotiated AVIF/WebP/JPEG, quality 90, no re-cropping, and no artificial enlargement. Originals bypass this optimization and remain owner-only. Authentication, block and moderation checks run before internal cache lookup; browser responses remain private. Internal cache keys include media URL, variant, output format, source ETag and pipeline revision. Images/cache failures fall back to working R2 delivery.

`SPIKEDATE_IMAGES_ENABLED` is false in staging configuration. Before enabling on staging, review the account's Images plan, add the Wrangler Images binding (`"images": { "binding": "IMAGES" }`), then set the flag to true and deploy through the normal staging workflow. Do not enable generative AI for dating-profile faces by default. This request does not purchase Images, enable the paid service, verify its live account availability, or deploy the Worker.

Sources: [Images binding](https://developers.cloudflare.com/images/optimization/binding/), [Images pricing](https://developers.cloudflare.com/images/pricing/), [MediaPipe face detection](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector/web_js), [browser still-photo capture](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Taking_still_photos).

## Verification

The first mobile run passed 25 of 26 checks and exposed one profile-hydration race: a background refresh could reset the open editor and close its camera. Initialization now runs once per editor opening, preserving unsaved edits and the camera/crop state. Visual inspection also caught progress text overlapping the close button; the progress row now reserves a 44px height and clear close-button space. Long suggested answers now use compact display labels while preserving their complete stored text and accessible names.

Final verification on September 18, 2026:

- Unit/API: 127 passed across 20 files; zero failures.
- Targeted browser regression: 26 passed, zero failed, zero skipped, no retries (6.4 minutes). Thirteen cases run on each of iPhone 13 and Pixel 7 viewport/device emulations using Edge Chromium.
- TypeScript, lint, formatting checks and staging build passed.
- Coverage: phone/signup validation, five-stage profile setup and draft resume, optional-field database persistence and full-profile rendering, failed-save recovery, private safety-camera checks, library upload/drag/zoom/retry on compact mobile and desktop, foreground Save, original/full/card/avatar delivery, profile-camera permission/retake/capture/save and late-stream cleanup, real detector single/group/no-face framing, own previews, theme geometry and Quiet Rail actions.
- Reports: `outputs/qa/quiet-studio/final/browser-report/index.html`, `playwright.json` and `junit.xml` in the same final folder. Registration screenshot: `outputs/vibe-registration-ios-mobile.png`.

Browser camera tests use synthetic video streams and the real bundled detector against local D1/R2. They are not physical iPhone/Safari/Android camera tests, SMS delivery tests or identity/liveness validation. Cloudflare optimization tests mock the Images binding; live paid Images delivery remains to be validated after enablement.

Reproduce the targeted mobile regression against an already-running local server:

```powershell
$env:SPIKEDATE_UI_URL = 'http://127.0.0.1:3007'
$env:SPIKEDATE_QA_REPORT_DIR = 'outputs/qa/quiet-studio/final'
npx playwright test tests/playwright/registration-fix.spec.ts tests/playwright/photo-upload.spec.ts tests/playwright/profile-camera.spec.ts tests/playwright/profile-preview-controls.spec.ts tests/playwright/quiet-rail.spec.ts tests/playwright/mobile-flows.spec.ts --grep 'signup validation|server rejects|photo upload:|profile camera:|photo framing:|Own preview|Preview theme geometry|Quiet Rail B|premium phone'
```

The local synthetic fixtures must be seeded first, as described in the QA-suite setup. Each photo test deletes only the new media it created, preserving the user's existing photos.
