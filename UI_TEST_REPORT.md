# SpikeDate UI test report

Date: September 12, 2026  
Target: mobile web application at 390 × 844 and 412 × 915 viewports  
Browser: Microsoft Edge (Chromium), headless UI automation

## Final result

- Comprehensive end-to-end scenarios: **162 passed / 162 tested**
- Registered-profile matrix: **50 passed / 50 profiles tested**
- Mobile smoke and expanded regression checks: **28 passed / 28 tested**
- Combined result: **240 passed / 240 tested**
- Final failures: **0**
- Unhandled browser exceptions: **0**
- TypeScript: **passed**
- Lint: **passed**
- Production build: **passed**

## Five-phase readiness validation

- Server unit checks: **4 passed / 4 tested**
- Live Cloudflare Worker API journeys: **17 passed / 17 tested**
- Focused iOS-size journeys: **5 passed / 5 tested**
- Focused Android-size journeys: **5 passed / 5 tested**
- D1 migrations: **3 applied successfully**
- Seed isolation: **50 synthetic `@spikedate.test` accounts**
- Server-backed mobile client: **enabled and exercised end to end**
- Latest final failures: **0**

The focused mobile suite verifies discovery and full-profile actions, Like and
Super Spike note sheets, Galaxy/Chat/Profile navigation, Profile Lift and
subscription safe-area behavior, and profile-photo crop/upload/display/removal
on both mobile platforms. The live
API suite additionally verifies age gating, authentication, all profile
foundations, 24-hour updates, discovery ranking, reciprocal matching,
message delivery/read state, Galaxy plans, purchase and entitlement accounting,
Super Spike decrement, authenticated R2 media validation/upload/order/serve/delete,
report/block enforcement, admin RBAC, and auditable case resolution.

The server-backed mobile pass initially exposed four stale test assumptions:
the Chat label includes its unread count, a Profile Lift may already be active,
the paywall opens from either “Free plan” or “SpikeDate+”, and its CTA varies by
billing state. The tests now cover those valid states and all ten focused
journeys pass on iPhone 13 and Pixel 7 dimensions.

## What was tested

- Account gate, sign-in, invalid credentials, account creation, password validation, session persistence, and logout
- Complete eight-section registration flow, required fields, profile completion, section editing, profile preview, and media limits
- Fifty seeded accounts covering women, men, and nonbinary profiles with varied age, distance, relationship intent, family plans, pets, drinking, smoking, interests, values, and preferences
- Profile image loading, full-profile opening, multiple-photo navigation, compact Profile Story layout, Reply Spike, sharing, reporting, and blocking
- Mobile 4:5 photo cropping, drag positioning, zoom, EXIF-aware orientation, 1440 × 1800 WebP export, low-resolution guidance, private R2 upload, media ordering, and removal
- Swipe, touch swipe, pass, Like, optional note, cancellation, Super Spike, weekly allowances, match creation, Incoming, decline, accept, and sent-like history
- Chat list, unread state, profile navigation, thread navigation, composer contrast, send, unsend, icebreakers, and safety tools
- Profile Lift explanation, eligibility, activation, visibility status, and subscription presentation
- Galaxy activity selection, browse tiles, filtered profile stack, Like and Super Spike actions, plan creation, activity-filtered venue browsing, shared availability, multi-venue voting, alternate-time proposals, accept/decline, private safety check-ins, review, send, and plan display
- Heart-with-hidden-S badge placement in Like/Super Spike context, Incoming notifications, sent Likes, chat list, chat header, match confirmation, Galaxy suggestions, and plan invite profiles
- Navigation labels, icons, active state, touch-target sizing, unread announcements, mobile overflow, and all four themes
- Voice entry points, feature switches, push-to-talk/live modes, command confirmation, cancellation, briefing, and scheduling
- Profile Story naming, branded heart-S Super Spike signal, Profile Lift naming, iconography, voice aliases, subscription copy, and active visibility state
- Today post creation, five daily prompts, 140-character updates, photo validation, three visibility levels, reply controls, matched-chat delivery, 24-hour expiration, unique views, home-card indicators, full-screen viewing, author management, and Like/Super Spike context

## Failures found and resolved during the run

The first complete run reported **14 failed assertions**. A separate first pass of the 50-profile matrix reported **1 image-timing failure**. All **15** were resolved and retested.

- Added the approved heart-with-hidden-S badge to every requested profile-avatar surface.
- Moved chat online presence to the top-right so it never overlaps the SpikeDate badge.
- Added clearer Chat copy explaining that messaging is available only for mutual matches and that avatars open profiles.
- Updated stale assertions for the current SpikeDate symbol navigation, red/orange brand palette, Profile Story wording, Midnight theme name, four-step public-venue plan flow, and Galaxy Super Spike behavior.
- Stabilized modal/tab navigation in the browser harness.
- Changed optimized-image validation to wait for image decoding, eliminating a false failure without hiding actual broken assets.
- Replaced legacy Spark, Rooms, Passport, and Boost selectors in the smoke and expanded regression suites with the current SpikeDate flows.
- Filtered demo venues immediately when the plan opens, removing a timing window where unrelated activity types could briefly appear.
- Added and retested the complete two-account Galaxy journey: creator invitation, recipient venue vote, alternate-time suggestion, creator acceptance, and safety check-in completion.
- Separated the Today indicator from the profile-card hit target so tapping a post opens the post while tapping or swiping the remaining photo continues to open or advance profiles.

## Completed readiness improvements

1. Added authenticated D1 storage and APIs for profiles, Likes, matches, messages, plans, blocks, subscriptions, usage allowances, daily updates, devices, privacy requests, and audit logs.
2. Connected signed-in mobile UI state to the Cloudflare APIs behind the `NEXT_PUBLIC_SPIKEDATE_SERVER_DATA_ENABLED` deployment switch while preserving the offline design-preview mode.
3. Keep the SpikeDate badge purely as brand/profile affordance. Use a separate checkmark for identity verification and a separate top-right indicator for online status.
4. Added the notification data model plus native push-token registration and SpikeDate deep links.
5. Added private R2 media, moderation states, protected report review, session controls, and auditable block enforcement.
6. Added Vitest, Playwright mobile projects, a 50-account live API journey, and web/Android/iOS CI jobs.
7. Aligned the generated D1 migration directory with the Cloudflare Worker package so clean staging environments can apply all migrations automatically.

## External release gates

- Apple receipt verification, Google Play verification, refunds, and signed
  store releases require the production store credentials and products.
- The production places provider requires its server token; staging continues
  to use safe built-in venues when it is absent.
- Android APK compilation requires Java/Android SDK (covered by Linux CI).
  iOS signing and App Store upload require Xcode and Apple credentials (covered
  through unsigned macOS CI until release hosting is supplied).
- Production deployment remains intentionally disabled until separately
  approved. Synthetic seeding and mock billing are disabled by default.
