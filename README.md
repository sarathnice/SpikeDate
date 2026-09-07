# PULSE

PULSE is a photo-first dating experience with profile discovery, Galaxy communities, matching, chat, preferences, registration, themes, and mobile-first layouts.

## Development website

Requirements: Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000` and use the demo account:

- Email: `demo@pulse.app`
- Password: `Pulse2026!`

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
- For a shared staging host, set `PULSE_STAGING_URL=https://your-staging-host.example` before running `npm run mobile:sync`.

Open the native projects with `npm run mobile:open:android` or `npm run mobile:open:ios`. Android Studio is required for Android builds. Xcode on macOS is required for iOS builds and signing.

## Validation

```bash
npm audit
npm run lint
npm run build
```

GitHub Actions validates the web build and Docker image, then builds an Android debug APK and an unsigned iOS simulator app. Cloudflare production deployment is intentionally deferred.
