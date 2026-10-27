# Business requirements and implementation status

Reviewed October 27, 2026. This describes the current implementation contract;
new scope and legal/product policy still need owner approval. Historical feature
requests are not evidence that every integration is complete.

## Core member requirements

| Requirement | Current implementation / acceptance rule |
| --- | --- |
| Adult onboarding | Age/terms and registration validation; phone flow; sectioned profile editors and separate photo management. Never bypass age or consent checks for convenience. |
| Photo-first discovery | Cinematic single main photo, transparent action rail, Home tools menu, relationship goal + one actual saved interest. No invented availability, shared interest or verification. |
| Browsing vs Like | Left/right profile browsing must not send a Like. Only explicit relationship actions write interactions. Own preview cannot send actions to self. |
| Search control | Gender/age/goals/lifestyle and saved discovery area; distance up to 100 miles or Anywhere. All adult ages + Anywhere still respect other preferences and safety exclusions. |
| Full eligible pool | Cursor pagination must progress beyond 50 and 500 candidates without duplicates or missed eligible batches. Self, blocked, noneligible and prior interactions can reduce visible totals. |
| Profile editing | Each category opens its own editor, not the entire registration wizard; close/header/save remain accessible with safe areas and keyboard. Shared preview/card controls must remain consistent. |
| Member media | Crop/review and display variants, original/private media handling, moderation metadata. Up to six profile photos; one profile video capped at 15 seconds/30 MB. |
| Photo Verified | Server-issued result only after trusted liveness and required photo-match checks pass. Never grant because a camera opened, a photo looks clear or an admin wants attractive fixtures. |
| Connection/chat | Persist explicit actions; reciprocal connection establishes a match. Messages/reactions require authenticated conversation access. Suggestions fill editable drafts and do not auto-send. |
| Today/tonight | User-authored current context and availability with expiry; show only real saved state. Do not imply someone is online or available from a generated fixture. |
| Galaxy/plans/games | Community discovery, conversation games and Durable Object arcade. Private matched plans require public venue/safety acknowledgment and counterpart confirmation. Preserve block/report cancellation. |
| Safety/privacy | Block/report, moderation and privacy-request workflows remain server-authorized. No unrestricted access to another member's location, chats, verification capture or billing. |
| Help/support | Approved guidance/member-scoped account checks; escalation to admin queue. AI cannot run arbitrary SQL, refund, ban, verify or impersonate a member. |

## Operations and business constraints

- Admin roles: super admin, safety reviewer, moderator, support agent, billing
  analyst and read-only analyst. Each route's allowed-role list is authoritative;
  UI visibility alone is not a permission check.
- Administrative changes must preserve actor/reason/audit evidence where the
  action supports it. Bulk data operations need a bounded selection, preview,
  explicit authorization, safe retry and validation; not all requested bulk
  coupons/gifts/overrides should be assumed complete.
- A fixture account is not an actual customer. Do not remove test provenance to
  make synthetic accounts look like real-member listings, issue false badges,
  fabricate chats or show false online activity.
- Profile counts such as the 698 imported fixtures are migration snapshots,
  not a guaranteed feed total or production metric. Git does not carry the
  existing D1/R2 member dataset into a new clone.
- Support may require owner review because there is no staffed call center;
  the UI must not promise instant human response or completed payment repair.

## Feature readiness and release gates

| Area | Current state | Must not claim / remaining work |
| --- | --- | --- |
| Cloudflare release | Manual GitHub workflow tested successfully | Homepage HTTP success is not signed-in end-to-end QA |
| TestFlight | Signed upload workflow exists; hosted staging UI | External testers require Apple's beta approval and an approved build in their group |
| SMS | Stage uses mock; Firebase adapter exists | No proof of real SMS delivery, anti-abuse or production provider configuration |
| Payments | Mock stage wallet/subscription behavior | Apple/Google receipt verification returns 501; not ready for real charges/refunds |
| Liveness | AWS integration/configuration exists | Must retest real device, camera permissions, trusted results, mismatches and retries; never weaken thresholds to make tests pass |
| AI Help | Optional Workers AI + fixed member-scoped checks | No unrestricted DB access or autonomous sensitive mutations; email depends on provider setup |
| Presence/push | Presence APIs and in-app notifications; optional push adapter | No fabricated online claims; provider/device delivery needs separate verification |
| Local fixture server | Existing local data can run on port 3007 | Fresh clone needs fixture state/source images; Windows workerd crashes are a known limitation |
| Production | Not established by staging success | Provider, security, legal/privacy, moderation, backups, store policies and production environment must be reviewed |

## Acceptance for a new feature

Agree the actor, desired outcome, privacy/consent, server authorization, persisted
state and failure behavior before implementation. Cover success, unauthorized
access, invalid input, empty state, retry/idempotency when relevant, cross-account
persistence and mobile layout. Changes touching billing, verification or admin
access need denial cases, audit evidence and a real provider/device test before
being represented as production-ready. Record test environment and mocks.
