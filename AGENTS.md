# SpikeDate: instructions for developers and coding agents

Read [docs/HANDOVER.md](docs/HANDOVER.md) first. The architecture, business rules,
code walkthrough and deployment runbook linked there are the current handover
baseline. Older QA/design reports are historical evidence, not release status.

## Working rules

- Inspect `git status` and preserve unrelated work. Do not reset, clean, or
  overwrite another developer's changes. Default branch: `codex/staging-mobile`.
- Treat the repository as a vinext React application deployed as a Cloudflare
  Worker, not as an ordinary Next.js/Vercel deployment. `app/page.tsx` is a large
  client orchestrator; find existing shared components before adding duplicates.
- APIs use Cloudflare D1 via `lib/server/db.ts`; private media lives in R2.
  Enforce authentication, authorization, validation and business rules server-side.
- Use parameterized SQL. Add schema changes to `db/schema.ts`, a new Drizzle
  migration and metadata. Never edit applied migrations to change shared data.
- Never fabricate verified status, live presence, billing confirmation or real
  membership. Fictional fixtures must remain isolated and disclosed. Never reply
  as another member or expose private chats through an unscoped AI/database tool.
- Keep secrets in ignored local environment files or encrypted platform secrets.
  Never commit tokens, signing material, database copies or QA screenshots.
  The owner's optional `handover/spikedate-credentials.json.gpg` is the sole
  approved ciphertext exception: require local encryption/decryption verification
  and explicit owner approval, never commit its plaintext or passphrase.
- Do not seed, bulk update/delete, change roles, upload profile data, or deploy
  shared infrastructure without explicit task authorization.
- For a feature: trace the UI/API/schema flow; add focused tests for success,
  denial, empty/error and mobile overflow cases; update the current docs.
- Minimum validation: lint, relevant unit/API tests and a build. State exactly
  what ran, what failed, whether browser requests were mocked, and whether a
  physical device or real external provider was tested. Green HTTP is not UI QA.
- Preserve iOS safe areas, visual viewport/keyboard handling, visible modal close
  controls and independent body scrolling. Swiping profiles browses; it must not
  send a Like. Reuse shared action icons and profile-card details.

## Commands

```text
npm ci
npm run lint
npx vitest run tests/discovery-pages.test.ts tests/discovery-location.test.ts
npm run build:staging
```

The local fixture server needs ignored D1/R2 state; a fresh clone is not a copy of
the developer's existing local dataset. See `docs/SELF_DEPLOYMENT.md` and
`docs/CODE_WALKTHROUGH.md`. Release only through the named workflow/runbook.
