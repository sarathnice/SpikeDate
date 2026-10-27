# SpikeDate architecture

Reviewed October 27, 2026. See [handover](HANDOVER.md) for scope and release evidence.

## Runtime and request path

```text
Web browser / Capacitor iOS or Android shell
    → Cloudflare static assets + workers/stage-entry.js
        → vinext-generated app (dist/server/index.js)
            → app/page.tsx or app/admin/page.tsx
            → app/api/**/route.ts
                → lib/server helpers
                    → D1: accounts, relationships, messages, metadata, ledger
                    → R2: private photo/video bytes
                    → AWS / optional AI, mail, push, venue adapters
        → /api/arcade/live → ArcadeRoom Durable Object
```

React 19 + TypeScript run through vinext/Vite. The Next-style `app/` structure
does not mean a separate conventional Next.js server is deployed. Staging uses
`wrangler.stage.jsonc`, not an implicit default Wrangler configuration.
`vite.config.ts` and `.openai/hosting.json` also participate in build/local
binding setup; keep them in a fresh clone. `package-lock.json` pins dependencies.

`app/page.tsx` owns much of the member UI, state hydration, tabs, overlays and
server-data mapping. CSS is split across global and feature styles imported in
`app/layout.tsx`. Some important overlay rules use named CSS layers and
`!important`; inspect computed styles rather than appending competing rules.

## Boundaries and data ownership

| Layer | Source / responsibility |
| --- | --- |
| UI | `app/page.tsx`, `components/`, feature CSS; never the authority for access or purchases |
| API | `app/api/`; validate input with Zod, authenticate, authorize, use parameterized statements |
| Authentication | `lib/server/auth.ts`, `crypto.ts`; salted password hashes, random session token, hashed token in D1; HttpOnly SameSite cookie, Secure on HTTPS |
| Database | `lib/server/db.ts`, `db/schema.ts`, `drizzle/`; D1 source of truth, no client database credentials |
| Media | `profile_media` metadata in D1; private R2 objects served through authenticated media routes |
| Mobile | `capacitor.config.ts`, `ios/`, `android/`; hosted staging UI plus native permissions/plugins |
| Operations | `app/admin/`, role-checked `app/api/admin/`, audit records |

Main data domains in `db/schema.ts`:

- Identity: users, sessions, profiles, preferences, profile connections/interests/prompts.
- Trust: phone challenges, verification requests/photo matches, media moderation,
  safety actions, appeals and privacy/data requests.
- Social: interactions, matches, conversations, messages, message media/reactions,
  Today updates/availability and presence preferences/live presence.
- Revenue: purchases, subscriptions, entitlement wallets/ledger, Lift activations.
- Plans/operations: Galaxy plans/invites/check-ins, games, notifications/devices,
  admin roles, support threads/messages, feature flags, banners and audit logs.

Database schema changes need a new migration and Drizzle metadata; current
journal reaches `0016_message_reactions`. Do not rename/rewrite applied migrations.
Retain D1 and R2 consistency: code deployment does not copy or back up either.

## Important flows

**Discovery:** `/api/discover` keyset-scans eligible candidates, returns bounded
pages (`limit` capped at 50) and `nextCursor`. `lib/discovery-pages.ts` follows
pages, deduplicates IDs, detects repeated cursors, then sorts the aggregate by
Lift/shared interests/visible activity. API `count` is page size, not total
member count. Images are separate requests. The aggregate can still be expensive
at larger scale; do not restore a fixed 50/500-profile ceiling as an optimization.

**Location:** `/api/discovery-location` saves mode `device`, `city`, `denied` or
`anywhere` for the authenticated account. Device coordinates are coarsened.
Foreground/native permission state, saved search area and registration city are
related but not identical concepts. Do not expose precise coordinates publicly
or promise continuous background tracking.

**Readiness:** `lib/server/profile-readiness.ts` centralizes readiness.
Discoverability reconciliation requires verified phone, completed profile,
photo verification, approved photo and requested visibility. Connection readiness
checks phone/completion/photo verification. Fixture imports may have explicit
test-only discoverability states; they are not proof a real member passed checks.

**Verification:** `app/api/verification/route.ts` orchestrates consent/session and
provider completion; `lib/server/aws-photo-verification.ts` owns trusted AWS
liveness results and profile-photo comparison. Quality-only/manual/mock capture
does not establish identity. Keep provider evidence and uploaded display photos
distinct. AWS mode is configured on stage; this is not proof every device/provider
scenario is currently healthy.

**Chat:** authenticated mutual-match membership gates conversation APIs. Quiet
reactions use the shared `message_reactions` state/API; polling and UI state are
not a substitute for server membership checks. Conversation suggestions are
local prompts, not auto-sent messages or AI-written impersonations.

## External adapters and feature flags

- `wrangler.stage.jsonc`: D1 `DB`, R2 `MEDIA`, Durable Object `ARCADE_ROOMS`, Images
  and Workers AI bindings, and non-secret staging flags.
- `lib/server/phone-verification.ts`: mock/Firebase adapters. Staging explicitly
  selects mock. `.env.example` is documentation, not actual environment state.
- `app/api/billing/purchase/route.ts`: mock writes; Apple/Google provider requests
  currently return 501 until receipt verification is implemented.
- `lib/server/help.ts`: bounded, member-scoped help; optional Cloudflare AI
  wording, no general SQL agent or autonomous account mutation.
- `support-email.ts`: optional Resend notifications; `notifications.ts`: in-app
  baseline and optional push; live provider credentials are separate secrets.

The staging entry adds no-store headers to HTML so the native shell can refresh
releases; fingerprinted assets retain caching. Environment disclosure is handled
by `lib/environment-banner.ts` and role-protected admin configuration.

## Security and production boundary

Admin authorization is implemented in `lib/server/admin.ts`: session, role list,
and optional matching Cloudflare Access identity. Staging currently sets the
Access requirement false; that does not bypass application RBAC. Production
must separately review Access enforcement, rate limits, retention, secrets,
provider readiness, moderation/privacy obligations, backup/recovery and real
payment/SMS integrations. Do not present staging test fixtures as real members.
