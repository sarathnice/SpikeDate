# Registration face capture — implementation and verification

## Findings

Before this change, Profile had a camera-quality dialog but registration never
opened it. The optional browser `FaceDetector` could be absent (`faceCount=null`)
and still pass. Local mode issued `photo_verified` from client-supplied metrics;
shared mode queued `needs_review` without retaining any image a reviewer could
actually inspect. Neither path performed face matching or anti-spoof/liveness.

## Research and recommendation

- [MDN camera access](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia): requires a secure context (HTTPS or loopback), explicit device permission, and appropriate camera lifecycle handling.
- [Google MediaPipe face detection](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js): locates faces/keypoints in a frame. This is not recognition or liveness. The self-hosted, pinned model/runtime keeps camera images on the device. One 480-pixel image is analyzed per capture, rather than running a continuous main-thread loop.
- [AWS Face Liveness](https://docs.aws.amazon.com/rekognition/latest/dg/face-liveness.html) and [CompareFaces](https://docs.aws.amazon.com/rekognition/latest/APIReference/API_CompareFaces.html): use a managed video challenge to assess physical presence, then compare its reference image with the approved primary profile photo. They are separate, probabilistic checks; a detected face or camera permission alone proves neither.
- [Apple camera authorization](https://developer.apple.com/documentation/avfoundation/requesting-authorization-to-capture-and-save-media): native iOS apps require a camera purpose string. The installed Capacitor Android `BridgeWebChromeClient` requests `Manifest.permission.CAMERA` for web video capture; the manifest must declare it.
- [ICO biometric guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/biometric-data-guidance-biometric-recognition/): before uniquely identifying people through biometrics, assess the applicable lawful basis, special-category condition, consent, rights and safeguards. This is jurisdiction-specific; a disclaimer does not establish legal compliance.

## Implemented now

1. Saving a **new registration** awaits all profile API saves, then opens the
   consent-based face-capture step. Editing an existing profile does not reopen it.
2. No camera request before consent. Front camera only; microphone is disabled.
   **Finish later**, close and permission denial preserve the saved profile.
3. MediaPipe Tasks Vision **0.10.32**, CPU, short-range BlazeFace float16 model
   version 1. Runtime assets are copied from the pinned dependency before dev/build;
   the model is versioned in `public/verification`. No runtime CDN request.
4. Require exactly one detected face, sufficient size, centered/not clipped,
   suitable brightness and image-detail contrast. Detection/model failure cannot
   pass. These are capture guidance only, not a security attestation.
5. `capture_ready` records a completed preparation check. **Neither mock nor
   manual mode can issue a verified badge from this endpoint.** Even forged
   perfect client metrics cannot make a profile discoverable.
6. Server-side account ownership, explicit consent, five-minute expiry, daily
   attempt limit, cancellation, replay rejection and data withdrawal. A camera
   session cannot unnecessarily downgrade an already verified account.
7. Camera tracks stop on close, background, success and cleanup. Late permission
   responses cannot reopen a dismissed dialog or leave a camera running.
8. Existing `verification_requests` stores consent version, timestamps, status,
   provider label and a capture SHA-256 hash. No selfie, video, landmarks or face
   embeddings are uploaded or stored. A hash is metadata, not proof of identity.
   `reviewed_at` remains null because no reviewer/provider has made a decision.
9. Profile and reload understand the new status. Existing readiness rules keep
   new accounts private until phone verification, completed profile, approved
   photo and a real verification decision are present.
10. Added native Android camera permission (camera hardware optional) and an
    honest iOS camera purpose string. Existing microphone settings preserved.
11. Fixed a latent empty-D1-batch error when optional prompts/interests are blank.
    A failed profile save now stays in setup with an actionable retry message,
    rather than announcing success and closing registration.
12. Screenshot review found a global toast covering the capture action. Global
    toasts are now suppressed while the verification modal is open; its own
    status/heading provides feedback instead.

## Remaining provider integration — not implemented or enabled

No live verification-provider credentials/session integration currently exists.
`manual` remains a legacy configuration name for capture metadata, **not a manual
review queue**. `identityVerificationConfigured:false` communicates this explicitly.
No existing account statuses were rewritten or badges retroactively revoked.

Recommended next implementation for real photo verification:

- Obtain approval for provider, region, privacy notice, consent, retention/deletion,
  accessibility alternative and human appeal process before sending biometrics.
- Authenticated Cloudflare API creates a short-lived, single-use provider session
  bound to account, consent version and current approved primary-photo ID/version.
- Use the provider's supported camera/video challenge and scoped short-lived
  client credentials; never expose permanent AWS credentials in frontend code.
- Server fetches the authoritative liveness result and performs photo comparison;
  do not trust client scores or booleans. Reject expired/replayed sessions and
  invalidate results when the primary photo changes.
- Calibrate thresholds and retry/manual-review paths using representative tests;
  do not equate a Photo Verified badge with age, background or personal safety.
- Issue `photo_verified` and reconcile discoverability only after trusted approval.
  Keep biometric evidence separate from public profile photos, apply deletion
  deadlines, access control and audit logging. Re-consent for the new processing.

## Test scope and report

The camera fixture uses an existing synthetic Maya portrait in a canvas-backed
MediaStream. **The MediaPipe model runs for real**: only the camera input is fake.
The still-image success deliberately demonstrates why detection is not liveness.
Permission denial/delayed permission and document backgrounding are simulated.
No real person was enrolled in a biometric service.

- `tests/registration-face-api.test.ts`: 14 SQLite-backed API/quality tests for
  auth, consent, profile prerequisite, null/zero/multiple faces, brightness/detail,
  account isolation, expiry, cancel, retry, attempt cap, replay, disabled/public
  mock handling, deletion, already-verified protection and forged-metric safety.
- `tests/profile-optional-fields.test.ts`: 2 empty-optional-save regressions.
- `tests/native-camera-permissions.test.ts`: 2 native configuration checks.
- `tests/playwright/registration-fix.spec.ts`: full account/phone/wizard flow,
  failed-save retry, automatic camera step, consent, denied permission, real
  blank/two-face/one-face detection, camera cleanup and persisted private status;
  also API signup validation.
- `tests/playwright/face-capture.spec.ts`: deferred capture, model failure,
  late permission response, close/background cleanup, retry, success, reload and
  withdrawal. Uses an approved uploaded synthetic main photo to show that even
  with other prerequisites complete, capture readiness does not grant visibility.
- Additional UI regressions: communication settings and protected Like/Spike
  sends between synthetic accounts.

Mobile tests emulate iPhone 13 and Pixel 7 viewports in Chromium/Edge. They do not
constitute physical-device camera testing, native Safari/WebView certification,
face-matching testing or anti-spoof testing. Native builds were not run here.

Reports: `outputs/qa/registration-face/final/` (HTML, JSON, JUnit, failed-test
artifacts). Screenshots: `outputs/qa/registration-face/examples/`.

### Final results

| Check                                          | Result                            |
| ---------------------------------------------- | --------------------------------- |
| Unit/API/native configuration tests            | 99 passed, 0 failed (14 files)    |
| End-to-end mobile-browser suite                | 14 passed, 0 failed/skipped/flaky |
| Final camera/screenshot retest after toast fix | 4 passed, 0 failed/skipped/flaky  |
| TypeScript (`tsc --noEmit`)                    | Passed                            |
| Lint (`npm run lint`)                          | Passed                            |
| Formatter (`oxfmt`, changed source files)      | Completed                         |
| Staging-mode local web build                   | Passed; not a deployment          |

The initial mobile signup cases failed on both viewport sizes because of the
empty optional-prompts D1 batch. Both passed after the fix. The screenshot-only
toast obstruction was also corrected and checked again on both viewport sizes.
The final camera retest reused a named account created by this local suite via
`SPIKEDATE_CAMERA_QA_REUSE_EMAIL`, avoiding additional SMS challenge requests.
Withdrawal tests delete only synthetic QA verification metadata; real account
records and production/staging data were not altered.

Dependency installation reports 10 audit advisories (6 moderate, 4 high) in the
overall dependency tree. These were not remediated through unrelated breaking
upgrades in this change and should be reviewed before release.

Run locally:

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build:staging
npm run arcade:local
# In a second terminal:
$env:SPIKEDATE_UI_URL='http://127.0.0.1:3007'
$env:SPIKEDATE_QA_REPORT_DIR='outputs/qa/registration-face/final'
npx playwright test tests/playwright/registration-fix.spec.ts tests/playwright/face-capture.spec.ts tests/playwright/communication-settings.spec.ts tests/playwright/protected-send.spec.ts
```

This work is local only; Cloudflare staging/GitHub are not changed by this request.
