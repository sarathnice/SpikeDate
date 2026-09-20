# Profile gallery upload fix — September 16, 2026

Staging: https://spikedate-stage.sarathnice.workers.dev/

## Changes

- Crop editor uses its own foreground overlay above registration.
- Header/Close and footer/Save remain visible while only the photo controls scroll.
- Crop preview adapts to short mobile screens while preserving the 4:5 ratio.
- “Use photo” is now the clearer “Save photo”.
- Preparing/uploading progress appears inside the foreground footer with a spinner and accessible status. An upload error leaves the editor open for retry or Close.

## Test coverage

Baseline legacy upload: 2 passed on tall mobile layouts; it did not verify drag, short-screen visibility or foreground progress. These gaps are now tested rather than claiming a reproduced baseline failure.

Expanded smoke includes 18 device-specific browser cases, six of which exercise profile uploads. New upload checks cover a real PNG selected from disk, drag/zoom, scrolling without losing Save, foreground hit-testing, controlled HTTP 503/retry, gated upload progress, successful server upload, decoded profile image, full/card/avatar/original downloads, persistence after reload and cleanup of the synthetic test photo.

Result: **18 passed, 0 failed**, with no retries or skipped cases. Report: `outputs/qa/2026-09-16T14-37-33-770Z-19536/index.html`. The generated report includes crop/progress screenshots.

Formatter, lint, TypeScript, 13 unit tests, three reporter tests and staging build were run. Deployment version: `9d4d47f2-f05e-4fb5-8376-584a1658fc8b`.

Only synthetic accounts 022/023 were used for uploads. Existing photos were preserved. Testing uses Playwright file-input selection and iPhone/Pixel viewport emulation in Chromium/Edge; native OS gallery pickers and native iOS/Android hardware were not tested. Production and Git publishing were unchanged.

These checks are included in future `npm run qa:stage` runs.
