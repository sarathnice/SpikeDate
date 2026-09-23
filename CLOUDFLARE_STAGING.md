# SpikeDate staging on Cloudflare

## Direct Cloudflare account staging

- Cloudflare account: `d22cf985cee89b0a3aa4618f2cb77370`
- Worker: `spikedate-stage`
- D1 database: `spikedate-stage`
- D1 database ID: `ca142a34-ff1e-4772-8f86-8580c744b86a`
- R2 bucket: `spikedate-media-stage`
- Worker configuration: `wrangler.stage.jsonc`
- Source repository: `https://github.com/sarathnice/SpikeDate`
- Source branch: `codex/staging-mobile`

The direct environment is intentionally isolated from all `pellichupulu`
resources. Deploy the exact checked-in staging revision with:

```bash
npm run deploy:cloudflare:staging
```

That command builds the staging client and Worker, applies all pending D1
migrations remotely, and deploys the Worker with its D1 and R2 bindings.
Runtime secrets are stored through Wrangler and are never committed.

## Managed staging environment

- Site title: `SpikeDate Staging`
- Site project ID: `appgprj_6a9eeb9869c0819187015dfddf41addb`
- Staging URL: `https://pulse-mobile-dating.sarathnice.chatgpt.site`
- Source repository: `https://github.com/sarathnice/SpikeDate`
- Source branch: `codex/staging-mobile`
- Access: owner-only custom access
- Runtime: Cloudflare Worker-compatible Vinext application
- Structured data binding: Cloudflare D1 as `DB`
- Media binding: private Cloudflare R2 as `MEDIA`

The managed Site owns the physical Cloudflare resource identifiers and injects
them during deployment. The application deliberately references only the
logical `DB` and `MEDIA` bindings in `.openai/hosting.json`.

## D1 data

The staging database currently contains these application tables:

- Accounts: `users`, `sessions`, `phone_verification_challenges`
- Profiles: `profiles`, `preferences`, `interests`, `user_interests`,
  `profile_prompts`, `profile_media`, `verification_requests`
- Discovery and communication: `daily_updates`, `daily_availability`,
  `interactions`, `matches`, `conversations`, `messages`, `notifications`,
  `notification_preferences`, `device_tokens`
- Billing: `subscriptions`, `purchases`, `entitlement_wallets`,
  `entitlement_ledger`, `profile_lift_activations`, `billing_events`
- Plans and safety: `galaxy_plans`, `galaxy_plan_invites`, `safety_check_ins`,
  `safety_actions`, `moderation_appeals`
- Operations: `admin_users`, `audit_logs`, `feature_flags`, `data_requests`

Migration `drizzle/0005_clumsy_sauron.sql` adds cinematic-photo metadata and
variant object keys to `profile_media`. Managed deployments apply saved Drizzle
migrations before uploading the new Worker.

## R2 media layout

New profile photos use this private object layout:

```text
profiles/{userId}/{mediaId}/original.{sourceExtension}
profiles/{userId}/{mediaId}/full.webp
profiles/{userId}/{mediaId}/card.webp
profiles/{userId}/{mediaId}/avatar.webp
```

Older single-object uploads continue to work. Removing a photo deletes its
original and every generated variant.

## Staging deployment flow

1. Push the validated commit to `origin/codex/staging-mobile`.
2. GitHub Actions runs linting, the Worker build, API/mobile tests, Docker, and
   Android/iOS build jobs.
3. Package the exact successful Worker build and Drizzle migrations.
4. Save and privately deploy a new version of the existing managed Site.
5. Confirm the deployment status and test the staging URL.

## Environment settings

Staging currently enables server-backed data, date plans, mobile verification,
manual photo/media review, in-app notifications, mock billing, and test seeding.
Voice commands and cloud transcription remain disabled. Secret values are
stored in the hosting environment and are never committed to Git.

## AWS Rekognition photo verification

SpikeDate supports AWS Rekognition Face Liveness followed by `CompareFaces`.
The flow is fail-closed: camera quality alone never issues a badge. A member is
marked `photo_verified` only when the liveness score and primary profile photo
both meet the configured thresholds. A questionable secondary photo is routed
to review. Uploading, replacing, approving, rejecting, or deleting a profile
photo removes the existing photo-verification state.

AWS setup requires two narrowly scoped identities:

1. Create a Cognito Identity Pool with unauthenticated identities enabled. Give
   its guest role only `rekognition:StartFaceLivenessSession` in the selected
   AWS region. This supplies short-lived browser credentials to the official
   AWS liveness component.
2. Create a dedicated Worker IAM principal with only
   `rekognition:CreateFaceLivenessSession`,
   `rekognition:GetFaceLivenessSessionResults`, and
   `rekognition:CompareFaces`. Rekognition uses `Resource: "*"` for these
   actions; do not reuse an administrator credential.
3. Configure non-secret values `SPIKEDATE_AWS_REGION`,
   `SPIKEDATE_AWS_COGNITO_IDENTITY_POOL_ID`,
   `SPIKEDATE_LIVENESS_THRESHOLD=90`, and
   `SPIKEDATE_FACE_MATCH_THRESHOLD=90`.
4. Store `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as encrypted Cloudflare
   Worker secrets. Add `AWS_SESSION_TOKEN` only for temporary credentials.
5. Apply Drizzle migration `0010_round_archangel.sql`, then set
   `SPIKEDATE_FACE_VERIFICATION_MODE=aws` and deploy. Keep the mode `manual`
   until every setting is present; the API deliberately returns 503 for a
   partially configured AWS environment.

Example for a direct Wrangler deployment:

```powershell
npx wrangler secret put AWS_ACCESS_KEY_ID --config wrangler.stage.jsonc
npx wrangler secret put AWS_SECRET_ACCESS_KEY --config wrangler.stage.jsonc
npm run db:migrate:staging
npm run deploy:cloudflare:staging
```

The live capture is not published as a profile image. SpikeDate stores the
liveness confidence, per-photo similarity decisions, provider/session audit
reference, and final status—not the liveness video or AWS reference frame.

## Viewing the managed deployment

The current staging URL is hosted on Cloudflare infrastructure through the
managed Sites service. Its physical Worker, D1 database ID, and R2 bucket ID do
not appear in a personal Cloudflare dashboard because the service owns those
resources.

The direct account environment above appears in the personal Cloudflare
dashboard under Workers & Pages, D1, and R2. The managed Site remains a useful
owner-only comparison environment, but it does not share data with the direct
account deployment.
