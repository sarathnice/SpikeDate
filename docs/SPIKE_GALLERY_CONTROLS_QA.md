# Spike icon, availability controls and photo gallery QA

Date: September 16, 2026. Target: local development at http://localhost:3005.

## Changes

- Shared Spike intro icon now contains a star and plus inside the message bubble.
- Switch track and thumb geometry is fixed; independent CSS translate no longer compounds the checked transform and pushes the thumb out of its track.
- Discovery returns all approved profile media in position order, capped at six photos and one video, rather than returning only a primary image.
- Full profiles include selectable photo thumbnails alongside the existing previous/next controls and photo count.
- My profile includes Your photos, the current count out of six, thumbnails and direct Edit photos access to the existing media editor.

## Verification

- Two browser-emulated mobile flows passed: iOS-sized and Android-sized, both tested at a narrow 320 × 740 viewport. These are browser tests, not physical-device Safari/native tests.
- Each flow checks the star and plus visibility, availability enabled/disabled and containment, three own-profile photos, opening the media editor, full-preview gallery count, next-photo navigation, direct third-photo selection and actual image loading.
- One mocked discovery API regression test verifies ordered multi-photo/video media URLs and approved-media filtering.
- All 14 unit tests passed. TypeScript, lint and production build passed. Changed files formatted with oxfmt.
- The initial mobile runs caught switch-thumb overflow. It was fixed and both mobile flows passed on retest. Screenshot review caught photo-heading wrapping; the edit control width was constrained and mobile flows rerun.

## Remaining

These changes have not been deployed to Cloudflare staging. A post-deployment test against staging with real stored media and physical iOS/Android devices remains necessary. No production data was modified by these local demo tests.
