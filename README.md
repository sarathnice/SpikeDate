# SpikeDate

Matched chat now includes live **Arcade** (Four in a Row, Bubble Duel, Guess Next) alongside ten Conversation games. See [Arcade setup and controls](docs/ARCADE_GAMES.md) and [Conversation games](docs/DATING_GAMES.md). Arcade requires the built Worker / Durable Object gateway, not a standalone Vite demo preview.

SpikeDate is a photo-first dating experience with profile discovery, Galaxy communities, matching, chat, preferences, registration, themes, and mobile-first layouts.

## Development website

Requirements: Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000` and use the demo account:

- Email: `demo@spikedate.app`
- Password: `SpikeDate2026!`

## Docker

Hot-reload development environment:

```bash
npm run docker:dev
```

Production-shaped staging container:

```bash
npm run docker:staging
```

Both expose the website at `http://localhost:3000`. The staging image compiles the Worker-compatible build and serves it with Wrangler inside the container.

## iOS and Android staging apps

The checked-in Capacitor projects load the configured staging website so the same tested experience runs on web, iOS, and Android.

```bash
npm run build
npm run mobile:sync:android
npm run mobile:sync:ios
npm run mobile:sync:stage
```

- Android emulator defaults to `http://10.0.2.2:3000`.
- iOS simulator defaults to `http://localhost:3000`.
- `npm run mobile:sync:stage` prepares both native projects against the live
  Cloudflare staging Worker.
- For a shared staging host, set `SPIKEDATE_STAGING_URL=https://your-staging-host.example` before running `npm run mobile:sync`.

Open the native projects with `npm run mobile:open:android` or `npm run mobile:open:ios`. Android Studio is required for Android builds. Xcode on macOS is required for iOS builds and signing.

## Validation

For repeatable mobile QA with a timestamped HTML report, run `npm run qa:stage`
or double-click `Run-SpikeDate-QA.cmd`. See [QA_SUITE.md](./QA_SUITE.md) for full
regression, 50-profile photo audits, fixture requirements and coverage limits.

```bash
npm run lint
npm test
npm run build
npm run test:ui
```

The production-shaped Worker uses Cloudflare D1 (`DB`) for application data
and private R2 (`MEDIA`) for profile media. Generate schema changes with
`npm run db:generate`; migrations are stored in `drizzle/` and packaged with
the Site. The complete phase inventory and release gates are documented in
[`PHASE_IMPLEMENTATION.md`](./PHASE_IMPLEMENTATION.md), with test evidence in
[`UI_TEST_REPORT.md`](./UI_TEST_REPORT.md).

Profile and Today photo pickers open a mobile 4:5 crop editor before saving.
The client corrects camera orientation, supports drag/zoom focal framing, and
creates separate high-quality full-profile, discovery-card, and avatar WebP
variants. The untouched upload is retained privately in R2 so a future crop can
be regenerated without losing detail. D1 stores the source dimensions and
focal metadata, while authenticated media routes select the smallest suitable
R2 object for each surface and remain backward-compatible with older uploads.
The client also warns about low-resolution, very dark, or overexposed photos.

The protected `/admin` dashboard requires an authenticated SpikeDate admin
role. Set `SPIKEDATE_ADMIN_ACCESS_REQUIRED=true` in shared environments to also
require the matching Cloudflare Access identity. Pending uploads enter a
review queue with approve/reject notes and immutable audit records.

## Cost-efficient premium services

- Account creation uses mobile verification. Local development uses code
  `123456`; shared environments use Firebase Identity Platform through the
  provider abstraction and registration tokens cannot be reused.
- Profiles remain hidden until registration, photo verification, and one
  approved photo are complete. Likes, messages, plans, Super Spikes, and
  Profile Lifts also enforce connection readiness server-side.
- Photos are cropped and compressed on-device. Video is limited to one MP4,
  MOV, or WebM file, 15 seconds and 30 MB, on both client and server.
- Notifications are always recorded in-app. FCM delivery is optional and is
  activated only when service-account credentials are configured; users have
  per-category switches and quiet hours.
- Venue search opens only inside the plan composer and is debounced. Built-in
  development venues keep local testing free.

## Safety-first date plans

Galaxy's **Plan a Date** flow is private to one active mutual match. It requires
a public-place selection and an explicit safety acknowledgement before sending.
The recipient must accept, changes require confirmation, and accepted plans keep
trusted-contact sharing and safety options available. Reporting or blocking a
match cancels shared plans. Plans disappear from normal history 30 days after
their scheduled time.

Set both `NEXT_PUBLIC_SPIKEDATE_DATE_PLANS_ENABLED=false` and
`SPIKEDATE_DATE_PLANS_ENABLED=false` to remove the client entry points and block
the plan API in an environment. Keep both enabled only where the complete safety
flow is ready.

The first-1,000-user infrastructure estimate is documented in
[`COST_MODEL_1000_USERS.md`](./COST_MODEL_1000_USERS.md).

## Photo verification

New registration → **Save profile** automatically opens the camera step.
Profile → **Verify your photos** also opens the mobile camera check. The user
must consent before camera access, place one face inside the guide, and pass
lighting and image-detail checks. A self-hosted MediaPipe detector requires exactly
one centered face. The captured frame is analyzed in memory and is not
saved or uploaded; the server stores only the check status and a one-way SHA-256
digest in the existing `verification_requests` audit table.

Set `SPIKEDATE_FACE_VERIFICATION_MODE=mock` only for local automated testing.
Use `manual` in shared environments. Both modes currently record only capture
readiness (`capture_ready`), **never a verified badge**. `manual` is not an image
review queue: no reviewable selfie is retained. Production approval must come
from a connected provider or a properly implemented trained manual-review flow,
never from the local quality check.

Camera permission denial and **Finish later** preserve the saved profile, which
remains private until phone verification, a completed profile, a real photo
verification decision, and an approved photo are present. See
`docs/REGISTRATION_FACE_CAPTURE.md` for research, test coverage, and the outstanding
provider integration.

GitHub Actions validates the web build and Docker image, then builds an Android debug APK and an unsigned iOS simulator app. Cloudflare production deployment is intentionally deferred.

## Activity briefing controls

SpikeDate defaults to a read-only, device-spoken activity briefing. It
summarizes likes, matches, messages, and allowances and can be scheduled
without a paid AI service. Copy `.env.example` to `.env.local` locally or
configure the same values during deployment:

- `NEXT_PUBLIC_PULSE_VOICE_ENABLED=false` hides all voice features.
- `NEXT_PUBLIC_PULSE_VOICE_COMMAND_ENABLED=false` keeps microphone commands off.
- `NEXT_PUBLIC_PULSE_VOICE_LIVE_ENABLED=false` keeps continuous conversation off.
- `NEXT_PUBLIC_PULSE_VOICE_CLOUD_ENABLED=false` removes the Cloudflare microphone fallback.
- `PULSE_VOICE_CLOUD_ENABLED=false` blocks cloud transcription server-side and is the production-safe default.
- `NEXT_PUBLIC_PULSE_VOICE_TEST_MODE=true` uses browser/device voice for charge-free testing.

These public flags contain availability only. AI provider credentials must
remain in server-side Cloudflare secrets. Both microphone modes are off by
default to control cost and reduce interface noise. They remain isolated for
future experiments; users can turn the scheduled activity briefing off from
Profile.
