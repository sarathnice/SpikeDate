# Explore — Option C

Naming update: the visible feature name is now **Galaxy**, including the navigation label, heading, tab-group label and back button. The approved Option C layout and internal `explore-*` selectors are unchanged.

Implemented locally on port 3007. Cloudflare staging is unchanged.

- Visible Galaxy navigation, hub title and back button are now Explore. Internal tab keys, database/API values and theme names are unchanged.
- Browse, Plans and Connect are accessible tabs with related icons and arrow-key/Home/End navigation.
- Browse has all eight photo categories in a two-column grid of 98 px tiles, with an icon next to each category name, compact count text and 8 px tile spacing.
- Plans retains the existing composer, invitations, venue votes, replies, calendar/directions and safety controls.
- Connect contains astrology and a Play Together shortcut to Chat. Games still require a mutual match and the existing conversation permissions.

Verification: final 2/2 mobile-browser tests passed in iOS-sized and Android-sized Chromium/Edge projects, checking 320/390/412 px layouts, exact tile height/grid placement, icons, hidden panels, keyboard navigation, composer opening, astrology disclaimer, Chat shortcut and category back navigation. Screenshot review caught legacy styles keeping wide/tall tiles; overrides were corrected and retested. No physical-device/Safari claim.

TypeScript, lint, staging-mode build and 55/55 unit/API tests also passed. Report: `outputs/qa/explore-tabs/retest/browser-report/index.html`. Actual mobile screenshots: `outputs/qa/explore-tabs-browse.png` and `outputs/qa/explore-tabs-connect.png`.

Browse counts and the existing plan suggestion data were not redesigned in this UI task; their existing logic is unchanged. Inline previews are illustrative and do not query the database.
