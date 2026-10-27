# Code walkthrough and extension guide

Start with [architecture](ARCHITECTURE.md) and [business rules](BUSINESS_REQUIREMENTS.md).
Use symbol search (`rg`) rather than relying on line numbers in this large app.

## Repository map

```text
app/page.tsx                    Member app, tabs, hydration and overlays
app/layout.tsx + app/*.css      Fonts, feature styles, shared shell
app/admin/                     Admin UI and banner controls
app/api/                       Authenticated HTTP routes by domain
components/                    Shared profile, chat, location/help UI
lib/                           Client/domain utilities and fixture definitions
lib/server/                    Auth, DB, readiness, providers, admin, arcade
db/schema.ts                   Drizzle table definitions
drizzle/                       Ordered SQL migrations + journal/snapshots
workers/stage-entry.js          Staging entry, HTML cache policy, arcade gateway
workers/profile-demo-local.js  Loopback-only local fixture wrapper
wrangler.stage.jsonc           Shared Cloudflare staging resources/flags
wrangler.profile-demo.local.jsonc  Existing local fixture storage bindings
vite.config.ts                 vinext/Vite/Cloudflare build integration
capacitor.config.ts + ios/ + android/   Native shells
tests/ + tests/playwright/      Unit/API and browser regression suites
.github/workflows/             CI, staging release, QA and native TestFlight
scripts/                       Media preparation, fixture/import/transfer tools
```

## Trace these flows first

1. **Sign in:** `app/page.tsx` → `app/api/auth/login/route.ts` →
   `lib/server/auth.ts` / `crypto.ts`. Follow cookie creation, active account
   lookup and `requireUser`, then the client account/discovery hydration.
2. **Discovery/filtering:** `app/page.tsx` (`loadDiscovery`,
   `profileFromDiscovery`, `matchesFilters`) → `lib/discovery-pages.ts` →
   `app/api/discover/route.ts`. Check API exclusions and client filters together.
   `app/api/discovery-location/route.ts` persists the separate discovery mode.
3. **Home card/preview:** find `CinematicPortrait` and profile-card markup in
   `app/page.tsx`. `ProfileIntentInterest` shares actual goal/interest display;
   `ProfileActionIcon` shares action symbols. `HomeTools` and `ProfileMoreMenu`
   consolidate controls. CSS precedence includes `quiet-rail` layers.
4. **Save profile/photo:** follow `app/api/profile/route.ts`, `app/api/media/route.ts`
   and `app/api/media/[id]/route.ts`; inspect crop/quality helpers under `lib/`.
   Preserve existing media on partial failures; keep R2 bytes and metadata aligned.
5. **Verification:** start with `app/api/verification/route.ts`, then
   `aws-photo-verification.ts` and `profile-readiness.ts`. The AWS trusted frame
   and thresholds are server concerns, not client-approved badge flags.
6. **Like → match → chat:** `app/api/interactions/route.ts` → match/conversation
   tables → `app/api/conversations/[id]/messages/route.ts`. Reactions add
   `components/chat-quiet.tsx`, `lib/chat-quiet.ts` and the sibling reactions route.
   Test participant membership, blocked/deleted states and persistence separately.
7. **Admin/support:** `app/admin/page.tsx` → `app/api/admin/**` →
   `lib/server/admin.ts`. For member escalation see `app/api/help/route.ts`,
   `lib/server/help.ts` and [member Help](MEMBER_HELP.md). Never expose raw DB
   access through a free-text assistant.
8. **Billing:** `app/api/billing/purchase/route.ts`, `lib/server/products.ts`,
   wallet and ledger schema. Understand provider rejection/idempotency before
   adding receipt validation; client plan selection cannot establish payment.

## Adding a feature safely

1. Confirm requirement and testable acceptance criteria with the owner.
2. Trace existing component/API/helper/schema; reuse common patterns rather
   than duplicating state or editing the generated `dist/` bundle.
3. Add a validated endpoint when persistence is needed. Derive the acting user
   from the session; check role/membership/readiness; bind SQL parameters.
4. If schema changes, add a forward migration and metadata with `db:generate`;
   inspect generated SQL before running any remote migration. Check old-data
   compatibility, backfill and recovery plan; do not fabricate missing status.
5. Wire pending/error/empty/retry UI, accessible names, safe mobile layout and
   correct cross-tab/cross-account refresh behavior.
6. Add focused tests and update current docs. Commit only intended source;
   use staging before native/production release.

## Test commands and interpretation

```powershell
npm ci
npm run lint
npx vitest run tests/discovery-pages.test.ts tests/discovery-gallery.test.ts tests/discovery-location.test.ts tests/chat-quiet.test.ts tests/environment-banner.test.ts tests/profile-action-icon.test.ts
npm run build:staging
```

`npm test` runs the full Vitest selection. `vitest.config.ts` currently matches
`tests/**/*.test.ts`; a new `.test.tsx` is not picked up by that pattern.
Several tests use real Node SQLite with mocked Cloudflare environment adapters;
they do not query the shared staging DB. Some tests require local fixture files.

For mobile component layout, `tests/profile-intent-interest.test.ts` launches
bundled Chromium. Install it with `npx playwright install chromium` if missing.
The deploy workflow intentionally uses the focused non-browser tests above.

For browser suites, `playwright.config.ts` defaults to Edge; set
`SPIKEDATE_PLAYWRIGHT_CHANNEL=bundled` for bundled Chromium and
`SPIKEDATE_UI_URL` for the target. iOS/Android projects are browser viewport
emulations, not native devices. Read each test's fixture/authentication assumptions;
some mock endpoints while others write to dedicated staging fixture accounts.
Do not run the entire browser suite against real-member data casually.
See [QA suite](../QA_SUITE.md) for runner modes and output locations.

## Common failures and debugging order

- **401/403:** check session, role, match membership and readiness before changing
  a UI assertion or weakening auth. Do not paste session cookies in reports.
- **Few profiles:** inspect returned cursor pages, saved age/gender/goals/location
  and safety/prior interactions. `count` is page size. Avoid reseeding to hide a bug.
- **Photo missing:** verify media ID/approval, auth route, R2 key and bytes, then
  image variant/cache/rendering. Code deployment is not a media transfer.
- **Editor above screen/hidden Close:** inspect safe-area, visual viewport,
  keyboard, ancestor transforms and layer precedence at 320/393/430px widths.
- **Windows EPERM during build:** stop the known local Worker before rebuilding.
  Workerd access violations are an observed runtime limitation, not a passed UI test.
- **Payment/SMS appears successful:** confirm mock flags before claiming provider
  delivery. Apple/Google purchase requests currently fail closed with 501.
- **CI differs from local:** check Node version, lockfile, missing ignored fixtures,
  `.openai/hosting.json`, actual workflow test set and platform browser channel.

## Suggested longer-term improvements (not completed features)

Gradually split member orchestration from `app/page.tsx`, add contract tests around
API response mapping, reduce all-at-once discovery refresh cost at scale, make
clean-clone fixtures reproducible without external private files, and establish
post-deploy authenticated smoke/device gates. Do not claim these are implemented.
