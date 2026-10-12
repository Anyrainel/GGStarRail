# Built browser coverage — 2026-10-12

The existing suite already exercises scanner formats, account identity,
partial-source merges, replacement confirmation, import review, localized
errors, and persisted store migrations. In particular,
`tests/components/game-account/imports/account-import.test.tsx` owns component
interactions and `tests/providers/scanner/formats/scanner-import.test.ts` owns
format validation. Audited GOODScanner experimental v2 and achievement v3
byte fixtures remain independent producer evidence. Do not duplicate those
cases in slower browser tests.

The new Playwright suite fills the production-bundle gap with two journeys at
desktop and mobile widths:

- Deep-link routes and lazy chunks load through the built Cloudflare preview;
  all six theme choices render, theme and Chinese locale survive reload,
  the shell has no horizontal overflow, and generated theme screenshots provide
  review evidence. Uncaught browser errors and failed scripts/styles fail tests.
- A representative independent HSR-Scanner v4 file passes through the actual
  file input, review counts, explicit apply, visible character roster, and
  persisted hydration after reload. Assertions use literal expected game IDs,
  levels and UID rather than importing the site's parser into the test.

The v4 browser fixture is the existing `tests/fixtures/scanner/hsr-scanner-v4.json`,
not a claimed GGScanner-generated export. GOODScanner's read-only
`experimental/hsr/src/scanner_export.rs` confirms the same HSR-Scanner v4
discriminator; its independent provider-level fixture coverage remains in the
fast suite. No scanner repository files are changed.

Run `npm run build` followed by `npm run test:e2e`. Install the browser once with
`npx playwright install chromium` (CI: `--with-deps chromium`). Playwright starts
and stops the local built preview itself, using local Cloudflare bindings. An
explicit `E2E_BASE_URL` can target an existing preview, including a deployed
site; imports and preferences stay in each isolated test browser context.
Screenshots and failure traces are under ignored `test-results/e2e/`.

CI runs this suite after the required check/build. Chromium installation belongs
to browser CI rather than the Cloudflare production build's dependency checks.
The suite is intentionally small and has no retries masking regressions.
