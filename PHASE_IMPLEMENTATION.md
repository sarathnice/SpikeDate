# SpikeDate five-phase implementation

## Phase 1 — Cloudflare data foundation

D1 now owns accounts, profiles, media metadata, preferences, interactions,
matches, conversations, messages, plans, subscriptions, entitlements, safety,
notifications, devices, privacy requests, feature flags, and audit history.
Private profile media is stored in R2 and served only through authenticated
routes. Three generated migrations define and evolve the schema.
The client uses these APIs when `NEXT_PUBLIC_SPIKEDATE_SERVER_DATA_ENABLED=true`;
the local design preview can keep the flag off for a fully offline demo.

## Phase 2 — Trust, safety, and compliance

Registration enforces age and terms acceptance. Passwords use salted PBKDF2,
sessions use hashed HttpOnly cookies, blocks apply in both directions, and
reports enter a role-protected review queue. Moderation decisions are written
to an immutable audit log. Export/deletion requests and media moderation states
are represented end to end.

## Phase 3 — Revenue and entitlements

Weekly, monthly, and annual SpikeDate+ products and standalone Profile Lift
packs share a transaction-safe wallet and ledger. Profile Lift lasts 30 minutes
and affects discovery ordering; Super Spike spends a weekly entitlement and
surfaces high intent. Local/staging uses an explicit mock adapter. Apple and
Google transactions are rejected until server receipt verification is
configured, preventing accidental unverified purchases.

## Phase 4 — Connection workflows and operations

The Worker API supports filtered discovery, Like, Super Spike, pass, save,
reciprocal matching, mutual-match chat, delivery/read state, daily updates,
Galaxy plan creation/invites, venue/date/time details, push-token registration,
and privacy/safety actions. The admin dashboard has RBAC, metrics, a safety queue,
review notes, warn/suspend/dismiss actions, and audit history.

## Phase 5 — Mobile, test, and release readiness

Capacitor projects include the SpikeDate identity, native deep links, network
state, notification registration, platform icons, and launch assets. CI builds
web/Docker, Android debug APK, and unsigned iOS Simulator artifacts. Automated
coverage includes unit, live Worker/D1/R2 APIs, 50 isolated profiles, and mobile
UI journeys for iOS and Android dimensions.
CI applies the D1 migrations, starts a local Cloudflare Worker, runs the live API
suite, and then runs the same server-backed UI journeys before building native
artifacts.

Production is deliberately out of scope for this iteration. Test seeding, mock
billing, Cloudflare Access policy, store credentials, production venue provider,
push certificates, Android signing, and Apple signing remain environment-owned
release controls.
