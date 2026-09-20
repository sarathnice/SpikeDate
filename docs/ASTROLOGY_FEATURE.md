# Star Connection

An optional Galaxy discovery tile using fixed Western sun-sign ranges supplied by the product owner. No AI service, external astrology API, new database table or migration is required.

## Data and behavior

- D1 `users.birth_date` determines the sign. Discovery exposes only the derived sign, never another person's birth date. The authenticated own-profile API returns the account owner's birthday for their own editor and their derived sign.
- Missing or invalid dates produce no sign; no birthday is guessed. Demo mode derives signs from demo fixture birthdays, separately from server mode.
- Registration displays a read-only derived zodiac field. Galaxy opens a dialog with a visible disclaimer and unchecked opt-in for pairing notes.
- The first attachment is directional: its row is interpreted from the viewer's sign. The second attachment lists symmetric pairs grouped into four separate themes. Conflicts are retained, not converted into one numerical score.
- Notes use neutral wording instead of promises about perfect partners, soulmates or guaranteed outcomes.
- A sign selector filters only this view. The eligible discovery pool, its ordering, blocks and normal preferences are unchanged. Count refers to the currently loaded discovery results, not every account in the database.
- View profile opens the existing full-profile experience. Home remains unchanged. Original chart images and source branding are not shipped as assets.
- Opt-in is local to the current view and is not a persistent public-profile privacy preference. A persistent sign-publication setting is a future enhancement.

## Verification

15 astrology unit tests cover all 12 starting boundaries and preceding dates, leap day and year wrap, invalid dates, directional pairings and separate symmetric themes. Discovery regression coverage checks derived Capricorn and absence of birth-date response fields.

The mobile Playwright flow covers Galaxy entry, disclaimer, initial opt-out, enabling notes, sign filtering and opening a full profile at 320 × 740 in two browser-emulated mobile projects. Results are in `outputs/qa/astrology`.

Local results: 29 unit tests passed; both mobile-browser flows passed, with no skipped tests. The initial UI run used an incorrect full-profile selector; it was corrected and retested. Type check, lint and build passed. These are browser emulations, not physical iOS/Android-device tests.

## Release considerations

Fixed dates are approximate; this is not ephemeris-based sun-sign calculation. The feature explicitly explains that cusp dates can vary by year and that astrology is entertainment, not a scientifically validated relationship/safety assessment.

A disclaimer is not legal clearance. Before commercial release, have counsel review the claims, consent/privacy behavior and rights to source chart content; do not assume user-supplied images establish reuse permission. No copyrighted chart artwork or horoscope prose is included. This local implementation has not been deployed to staging.
