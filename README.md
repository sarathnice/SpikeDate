# SpikeDate

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
```

- Android emulator defaults to `http://10.0.2.2:3000`.
- iOS simulator defaults to `http://localhost:3000`.
- For a shared staging host, set `SPIKEDATE_STAGING_URL=https://your-staging-host.example` before running `npm run mobile:sync`.

Open the native projects with `npm run mobile:open:android` or `npm run mobile:open:ios`. Android Studio is required for Android builds. Xcode on macOS is required for iOS builds and signing.

## Validation

```bash
npm run lint
npm test
npm run build
npm run test:ui
```

The production-shaped Worker uses Cloudflare D1 (`DB`) for application data
and private R2 (`MEDIA`) for profile media. Generate schema changes with
`npm run db:generate`; migrations are stored in `migrations/` and packaged with
the Site. The complete phase inventory and release gates are documented in
[`PHASE_IMPLEMENTATION.md`](./PHASE_IMPLEMENTATION.md), with test evidence in
[`UI_TEST_REPORT.md`](./UI_TEST_REPORT.md).

The protected `/admin` dashboard requires an authenticated SpikeDate admin
role. Set `SPIKEDATE_ADMIN_ACCESS_REQUIRED=true` in shared environments to also
require the matching Cloudflare Access identity.

GitHub Actions validates the web build and Docker image, then builds an Android debug APK and an unsigned iOS simulator app. Cloudflare production deployment is intentionally deferred.

## Voice deployment controls

SpikeDate includes low-cost push-to-talk and optional continuous live conversation. Copy `.env.example` to `.env.local` locally or configure the same values during deployment:

- `NEXT_PUBLIC_PULSE_VOICE_ENABLED=false` hides all voice features.
- `NEXT_PUBLIC_PULSE_VOICE_COMMAND_ENABLED=false` disables push-to-talk only.
- `NEXT_PUBLIC_PULSE_VOICE_LIVE_ENABLED=false` disables live mode while retaining push-to-talk.
- `NEXT_PUBLIC_PULSE_VOICE_CLOUD_ENABLED=false` removes the Cloudflare microphone fallback.
- `PULSE_VOICE_CLOUD_ENABLED=false` blocks cloud transcription server-side and is the production-safe default.
- `NEXT_PUBLIC_PULSE_VOICE_TEST_MODE=true` uses browser/device voice for charge-free testing.

These public flags contain availability only. AI provider credentials must remain in server-side Cloudflare secrets. Users can also turn Voice or Live conversation off from Profile, but cannot re-enable a feature disabled at deployment.
