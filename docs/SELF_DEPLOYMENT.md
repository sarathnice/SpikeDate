# Deploy SpikeDate yourself

Release branch: `codex/staging-mobile` (the repository's current default branch).
Staging website: https://spikedate-stage.sarathnice.workers.dev/

## Current verified setup (October 27, 2026)

The GitHub `staging` environment already has the encrypted `CLOUDFLARE_API_TOKEN`
secret. Do not recreate it for ordinary deployments. The approved account-scoped
Workers Scripts Edit + D1 Edit token expires **January 25, 2027**; rotate it before
expiry or immediately if compromised. Do not extract existing Apple secrets.
The [first verified GitHub release](https://github.com/sarathnice/SpikeDate/actions/runs/40521749065)
succeeded, including the homepage HTTP check. No signed-in browser/device QA was
part of that run. The setup instructions below are for rotation/new environments.

## GitHub Actions: Cloudflare staging

One-time setup:

1. Create a scoped Cloudflare API token in the Cloudflare dashboard. Use the
   **Edit Cloudflare Workers** template as the starting point, scoped to the
   SpikeDate account. Grant **Workers Editor** (or legacy **Workers Scripts:
   Edit**) for the existing Worker, plus **D1: Edit** for database migrations.
   Binding existing R2, Images and Workers AI resources does not itself require
   direct edit permission on those products. Follow Wrangler's error guidance
   only if additional permissions are needed; do not grant broad account access.
   Use a deployment token, not a Global API Key or your local Wrangler OAuth token.
2. In GitHub, open **Settings → Environments → staging → Add environment secret**.
   Name it `CLOUDFLARE_API_TOKEN` and paste the token as its value.
   Never put it in source code, a workflow file, or a chat message.
3. Optionally require your approval under the staging environment's protection
   rules. Anyone with permission to run this workflow can otherwise update staging.

Deploy:

1. Push reviewed source changes to `codex/staging-mobile`.
2. Open **Actions → Deploy SpikeDate to Cloudflare staging → Run workflow**.
3. Select `codex/staging-mobile`; enter `deploy-stage` in the confirmation field.
4. Click **Run workflow**. The job installs locked dependencies, lints, runs
   focused regression tests, builds, applies pending D1 migrations, deploys,
   and checks the website. Its summary records the deployed Git commit.

This is a manual release workflow; ordinary pushes do not deploy to Cloudflare.
Wrong branch or missing confirmation causes the deploy job to be skipped.
Review pending `drizzle/` migrations before deployment: they modify shared data.
The workflow does not create accounts, seed profiles, copy local photos, or
upload a new TestFlight binary. The separate iOS TestFlight workflow remains
available for native releases and uses its existing Apple signing secrets.

## Windows: existing local copy with profile data

Install Git and Node.js 22.13 or later. In PowerShell:

```powershell
cd "C:\Users\sarat\OneDrive\Documents\ChatGPT\PLUSE-APP"
git status
# Pull only with a clean working tree; preserve or commit your changes first.
git pull --ff-only origin codex/staging-mobile
npm ci
npm run build:staging
npm run profiles:local
```

Open http://127.0.0.1:3007/. Keep the terminal open. Stop with Ctrl+C before
rebuilding; the running Windows Worker can lock build files. Native workerd
access violations have occurred on this Windows machine; a successful start
does not prove every database-backed flow works.

The local profile command expects ignored files under
`outputs/qa/profile-import/`, including `local.env` and the persisted local
D1/R2 state. A fresh clone does not include those private/runtime files or
the external source photo collection. Back them up separately, securely.

## Fresh clone: development preview

```powershell
git clone --branch codex/staging-mobile https://github.com/sarathnice/SpikeDate.git
cd SpikeDate
npm ci
npm run dev
```

Open the address printed by the server (normally http://localhost:3000/).
This is not a copy of the staging database or the existing local profile store.
For environment setup, start from `.env.example`, use local-only test values,
and keep `.env.local` ignored. Do not use production credentials for a UI preview.

## Deploy directly from PowerShell

```powershell
npx wrangler login
npx wrangler whoami
npm run lint
npm run deploy:cloudflare:staging
```

Use the Cloudflare account owning `spikedate-stage`. The deployment command
builds and applies pending remote migrations before publishing the Worker.
Existing Worker secrets remain server-side; source deployments do not include
local environment files. D1 profiles and R2 photos are separate from Git and
are not transferred by deploying app code.

The current iOS staging shell loads this hosted website. Fully close and reopen
it after a web deployment. Native capabilities, signing, and app-icon changes
still require a new iOS build through **SpikeDate iOS TestFlight**.

## Release checks

- Confirm the Actions job succeeds and note its commit SHA.
- Open the staging website; sign in with an authorized test account.
- Check profile discovery, Home tools, profile preview, and matched chat.
- Check both phone-width web layout and a physical TestFlight device.
- Billing and SMS are currently configured as mock providers in staging.
- Do not commit `.env*`, API keys, certificates, private signing files, local
  databases, or generated QA outputs. Public IDs in Wrangler config are not keys.

References: [Wrangler deployment](https://developers.cloudflare.com/workers/wrangler/commands/workers/),
[Cloudflare API tokens for CI](https://developers.cloudflare.com/workers/ci-cd/external-cicd/).
See also [Workers authorization](https://developers.cloudflare.com/workers/authorization/).

## Failure and recovery

- Missing/expired token: update the environment secret, not source code, then
  rerun the workflow on the intended revision. Never log the token to debug it.
- Failed test/build: inspect the failing job, fix/retest and push a new commit;
  do not remove a gate to get a green release.
- Failed migration: stop and inspect D1 state before retrying. The command applies
  migrations before publishing code, so a failed deploy can leave schema changes.
- Failed deployment: check Wrangler's error and resource permissions. Existing
  code may still be live; verify the actual Worker version rather than assuming.
- Bad release: select a known-good Worker version in Cloudflare's version history
  using the supported rollback flow after assessing schema compatibility. Worker
  rollback does **not** undo D1 migrations, member writes or R2 object changes.
- Before a destructive migration/import, make and verify separate D1 and R2
  backups and a restore plan. Never delete shared data to recreate a test fixture.
- A full clean-room deployment to a new account needs separately provisioned
  D1/R2/DO resources, correct account/resource IDs, provider secrets and a migration
  plan. This workflow targets the existing staging account; it is not a complete
  new-account provisioning or production rollout system.
