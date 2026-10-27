# SpikeDate developer handover

Baseline reviewed: **October 27, 2026**. This is an implementation handover,
not a claim of production readiness or a substitute for product-owner approval.

## Start here

| Read in order | Purpose |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Runtime, boundaries, data ownership, integrations |
| [Business requirements and feature status](BUSINESS_REQUIREMENTS.md) | Current rules, acceptance criteria, mocks and gaps |
| [Code walkthrough](CODE_WALKTHROUGH.md) | Entry points, flows, tests and how to add a feature |
| [Self-deployment](SELF_DEPLOYMENT.md) | Local setup, GitHub Cloudflare releases, secrets, recovery |
| [Repository agent instructions](../AGENTS.md) | Rules for another developer or AI coding tool |
| [QA suite](../QA_SUITE.md) | Broader test commands and evidence limitations |
| [iOS/TestFlight](IOS_TESTFLIGHT.md) | Native signing, upload and tester distribution |

## What is actually handed over

- Source, tests, schema migrations, two small fixture assets and release workflows
  are in [GitHub](https://github.com/sarathnice/SpikeDate), default/release branch
  `codex/staging-mobile`.
- The app runs on Cloudflare staging. Git is not the database or media backup.
- Profile data/photos in D1/R2 and the existing local imported profile collection
  are separate resources. A clone does not contain all local/staging profiles.
- Private environment files, Cloudflare credentials, Apple signing material,
  generated builds and QA outputs are intentionally excluded from Git.
- Give the new developer their own appropriate GitHub/Cloudflare access. Do not
  share your personal login, Global API Key, or unencrypted signing files.

## Confirmed release evidence

Application sync and manual Cloudflare workflow were pushed in commit
[`2e1fb0a`](https://github.com/sarathnice/SpikeDate/commit/2e1fb0a00f228aff24d9675414a38afebbe91b7b).
The real [GitHub deployment run 40521749065](https://github.com/sarathnice/SpikeDate/actions/runs/40521749065)
completed successfully on October 27: dependency install, lint, focused tests,
build, pending migration application, Worker deployment and homepage HTTP check.
This run did **not** perform a signed-in post-deploy browser walkthrough or
physical iPhone testing. Previous UI reports are scoped to their recorded builds.

GitHub's encrypted `staging` environment now contains `CLOUDFLARE_API_TOKEN`.
The approved token expires **January 25, 2027**. Its Workers Scripts Edit and
D1 Edit permissions apply to the selected Cloudflare account, not just one
Worker/database; the workflow itself restricts the target to staging.
Rotate before expiry and review permissions when adding a production environment.

## First-day acceptance checklist

1. Read the documents above and confirm repository/environment access.
2. Clone, install locked dependencies and start the development preview.
3. Run lint, focused tests and a staging build. Install Playwright Chromium if
   executing browser tests; their credentials/data requirements are not universal.
4. Ask the owner for an authorized test login and any required local fixture
   backup through a secure channel; do not infer credentials from historical notes.
5. Trace registration → discovery → mutual match → chat through the source.
6. Use the GitHub staging workflow with explicit approval, note its commit SHA,
   then test key signed-in journeys. Do not treat the root HTTP check as release QA.
7. Record remaining gaps, intended changes and acceptance tests before starting
   a new feature. In particular, payment/SMS mocks cannot be advertised as live.

## Documentation precedence

Code/configuration and observed environment state are authoritative for behavior.
This handover set records the reviewed baseline and points to that evidence.
Root phase reports and older design/QA notes describe earlier milestones; do not
assume an old credential, screenshot, count or provider status is current.
When behavior changes, update the relevant handover page and tests in the same PR.

## Starter prompt for another AI coding tool

```text
Read AGENTS.md and docs/HANDOVER.md, including the linked architecture,
business requirements, code walkthrough and self-deployment runbook.
Inspect git status and the relevant implementation before changing anything.
Task: [describe the new feature and acceptance criteria].
Preserve existing behavior and private data; enforce server-side permissions.
Add focused tests, report exact validation and update the handover if behavior
changes. Do not seed shared data, change secrets/roles or deploy unless I explicitly
authorize it. Explain any missing credentials, local fixtures or provider gaps.
```

No AI tool automatically has access to the owner's platform accounts, ignored
files or this conversation. The repository supplies context and instructions;
the owner must grant appropriate access and approve consequential operations.
