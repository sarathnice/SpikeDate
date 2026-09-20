# Registration fixes and verification

Verified locally on September 17, 2026. No Cloudflare deployment or Git publication was performed.

## Changes

- Signup now asks for the real birthday and gender; it no longer sends a fabricated birthday or placeholder gender to account creation.
- Explicit, unchecked-by-default age/terms/privacy consent is required.
- Browser and server share password validation: 12–128 characters, uppercase, lowercase and a number.
- Browser and server share adult-date validation, including rejection of impossible dates.
- Profile setup begins with the birthday and gender entered during signup, with blank personal details instead of fabricated demo details.
- Profile completion sends birthday and gender to the server. Profile updates persist the birthday in `users.birth_date` and gender in `profiles.gender` using a D1 batch.
- Reloaded profile data restores gender as well as birthday.
- Signup select controls and consent checkbox have scoped mobile styling; the create-account button is reachable by scrolling.

## Verification

- Formatter: `npx oxfmt` on changed source/test files.
- Type checker: `npx tsc --noEmit`.
- Linter: `npm run lint`.
- Unit/API suite: `npm test`, 59 tests passed.
- Build: `npm run build:staging`, passed; this command builds locally and does not deploy.
- Registration UI/API suite: `tests/playwright/registration-fix.spec.ts`, 4 tests passed, 0 failed.
- Regression suite: `compact-profile.spec.ts` and `explore-tabs.spec.ts`, 4 tests passed, 0 failed; existing login, compact photos/editing and Galaxy destinations remain functional. Total mobile browser tests: 8 passed, 0 failed.
- Platforms: Chromium browser emulation using iPhone 13 and Pixel 7 viewport/device settings, not physical iOS/Android devices.
- Environment: local Worker at `http://127.0.0.1:3007`, isolated local D1 database `spikedate-arcade-local`. Phone codes use the existing mock provider; no SMS messages were sent.

Each mobile flow checks short-password rejection, underage rejection, unchecked-consent rejection, phone-verification requirement, mock phone verification, scrolling to Create account, actual signup birthday/gender propagation, empty first name, profile wizard completion, edited birthday/gender persistence, server rejection of an underage birthday update, and persistence after reload. Separate API checks reject invalid registration without relying on UI validation.

HTML report: `outputs/qa/registration-fix/browser-report/index.html`.

Regression report: `outputs/qa/registration-regression/browser-report/index.html`.

The process on port 5420 serves a static iPhone preview, not the current application. Use port 3007 to exercise the updated signup flow.

## Remaining launch requirements

No published terms-of-service/privacy-policy pages exist in the inspected project. The consent control is now explicit, but approved policy documents and accessible links must be added before real onboarding. This is not legal clearance. Real SMS delivery and physical-device behavior were not tested. Cloudflare staging has not received these changes.
