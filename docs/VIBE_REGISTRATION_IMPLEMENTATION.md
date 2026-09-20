# B · Vibe Cards registration and photo quality

Implemented locally on September 18, 2026. No Cloudflare deployment, Git commit, push, schema migration, or production configuration change was performed for this request.

## Registration

Mobile verification comes first; account fields appear after verification when the phone-verification feature is enabled. Birthday, gender, terms, and password validation remain enforced. A Show password control replaces the duplicate password entry.

The five profile stages are:

1. Name and city. Account birthday and gender carry forward.
2. Relationship goal and preferred genders. Additional preferences are collapsed.
3. At least one uploaded and framed photo. More photos and video remain optional.
4. Optional Vibe Cards: twelve conversation starters, suggested one-tap answers for the first three, optional interests, and an editable short answer. Users may skip this stage.
5. Review with links back to basics, connection, photos, and vibe; then the existing camera safety check.

Drafts are stored per account in local storage and can be restored within seven days. Successful completion clears the setup draft. Detailed family, lifestyle, work, identity, and discovery editors remain available after setup. Today and tonight availability are not enabled automatically.

The mobile modal keeps its title, close control, and actions outside the scrolling content. Stage changes return the content to the top. A partially successful save and retry no longer bypass the camera handoff. Actual prompt questions and their answers are saved and shown together, rather than assigning answers to fixed template headings. Discovery retrieves those pairs in one batched query to the existing `profile_prompts` table.

## Photo quality

Natural is the default. Gentle light is an explicit, optional +6% RGB brightness adjustment; it does not reshape faces or change saturation. It uses pixel processing rather than the inconsistently supported Canvas filter property. Existing display-time brightness/contrast/saturation boosting is removed, avoiding a second filter on already processed uploads.

The editor provides three exact saved-framing previews:

| Variant      | Target cap  | Aspect ratio |
| ------------ | ----------- | ------------ |
| Full profile | 1440 × 1800 | 4:5          |
| Discovery    | 1080 × 1920 | 9:16         |
| Avatar       | 480 × 480   | 1:1          |

The same crop geometry is used in the live canvas preview and export. EXIF-aware bitmap decoding, focal positioning, zoom, high-quality resizing, and WebP export are retained. Output dimensions decrease for small or heavily zoomed sources instead of artificially upscaling them. Limited detail, dark exposure, and very bright areas produce warnings. The original upload is retained separately; tests verify its SHA-256 digest matches the uploaded file. This is not a claim that EXIF metadata is removed from the preserved original.

Cinematic presentation comes from framing, edge-to-edge coverage, adequate source resolution, and unobtrusive readability treatments—not heavy beauty filters. Brightness cannot restore missing source detail. Existing photos are not reprocessed or overwritten by this change.

## Modified implementation files

- `app/page.tsx`: account flow, five-stage setup, draft/review behavior, prompt display, server hydration, and camera retry handoff.
- `app/layout.tsx`: new stylesheet imports.
- `app/registration-vibe.css`: scoped Vibe Cards typography, tiles, fixed controls, scrolling content, and progress contrast.
- `app/photo-quality.css`: exact crop canvas, variant controls, lighting selector, warnings, and natural photo display.
- `components/photo-cropper.tsx`: exact previews, shared crop geometry, optional lighting, quality notices, and bitmap cleanup.
- `lib/registration-prompts.ts`: twelve optional starters and the five-stage sequence.
- `lib/photo-framing.ts`: bounded crop geometry, no-upscale output sizing, variant definitions, and gentle-light pixel processing.
- `lib/account-validation.ts`: metric and typographic imperial height conversion, preserving database heights on edits.
- `app/api/discover/route.ts`: batched saved prompt retrieval.
- Unit/API tests: account validation, crop geometry/lighting, prompt catalog, and discovery prompt pairs.
- UI tests: registration, photo upload, own full preview, and affected phone-verification/display assertions.

No logo assets or unrelated media assets were overwritten. Screenshots and browser reports are QA outputs, not application assets.

## Verification

- Formatter: `npx oxfmt` on changed files.
- Type checker: `npx tsc --noEmit`.
- Linter: `npm run lint`.
- Unit/API suite: **122 passed, 0 failed**, across 18 test files.
- Build: `npm run build:staging` completed successfully. This builds locally; it does not deploy.
- Initial focused UI run: 12 passed, 6 failed. Four failures were a new test-script variable-scope error; two exposed the camera handoff after partial save. Both causes were corrected.
- Rebuilt focused UI retest: **18 passed, 0 failed**.
- Final expanded UI run: **20 passed, 0 failed, 0 skipped**, covering ten scenarios in each iPhone/Android-emulated project. Results are recorded in `outputs/qa/vibe-registration/final/playwright.json` and the HTML report alongside it. This final run includes optional-stage skipping, draft restoration, and checking the newly registered user's saved starter in both card and full-profile previews.

The browser suite covers account validation, optional-stage skipping, draft close/reopen, required photo validation, profile-save failure/retry, camera consent/permission/single-face checks, saved starter previews, foreground Save/Close controls, photo drag/zoom, all crop proportions, actual lighting changes, upload failure/retry/busy states, original-byte preservation, persisted gallery navigation, online-status privacy, home actions, and theme/viewport fit.

Testing uses local D1/R2 persistence and isolated synthetic accounts. Mobile projects use iPhone/Android viewport and touch emulation in Chromium/Edge; they are not physical-device or Safari certification. The local SMS provider and camera test streams are synthetic. A successful camera quality check remains `capture_ready`, not identity verification or a verified badge; profiles remain private until the existing verification/moderation requirements are satisfied.

## Research references

- [MDN: createImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap): image decoding and orientation.
- [MDN: Canvas filter](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter): limited browser availability.
- [web.dev: Image performance](https://web.dev/learn/performance/image-performance): appropriate image sizing and delivery.
- [web.dev: WebP](https://web.dev/articles/serve-images-webp): image format optimization.

Next external checks are physical iOS/Safari and Android upload/camera testing, including device photo formats, followed by an explicitly authorized staging deployment. Real SMS delivery and identity verification were not activated by this change.
