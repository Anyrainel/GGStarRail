# Hosting and data updates

Production is a single Cloudflare Worker named `ggstarrail` at
https://hsr.ggartifact.com. It serves the Vite output and the existing `/api/`
import handlers. No database, bucket, or GenshinTools credentials are needed.

`npm run dev` runs both the frontend and the Worker through Cloudflare's Vite
plugin on one origin. `npm run demo:start` starts this same server and checks
both the page and `/api/health`. `vite build` emits browser assets in
`dist/client` and the Worker plus deployment configuration in `dist/ggstarrail`.
Wrangler uses the generated deployment configuration when publishing the build.
The source `wrangler.jsonc` keeps explicit asset routing: extensionless app
navigations fall back in the Worker, while missing files keep their 404 status.

`npm run types:worker` generates bindings and runtime declarations from the
Wrangler configuration. `npm run check:worker-types` rejects drift. Worker
validation keeps direct Node unit tests and adds workerd integration tests with
real bindings, static assets and outbound requests mocked by MSW. Build the app
before running the runtime tests so their assets match the production output.

## Website sign-in

Both game sites share the existing Logto **Single Page App**
`tglrsenlbfrfrnevjwlan` at `https://auth.ggartifact.com`.
In that app, add `https://hsr.ggartifact.com/callback` as a redirect URI and
`https://hsr.ggartifact.com/` as a post sign-out redirect URI, keeping the
Genshin URLs. If the tenant requires an allowed-origin list, add
`https://hsr.ggartifact.com`. No new Logto application or client secret is needed.
These public defaults are bundled, so no new Cloudflare variables are needed.
Optional `VITE_LOGTO_ENDPOINT` / `VITE_LOGTO_APP_ID` overrides belong in the
Cloudflare **build** environment or `.env.local`, followed by a rebuild;
runtime Worker variables do not configure the Vite bundle.

For local testing register the exact dev origin, for example
`http://localhost:5173/callback` and `http://localhost:5173/`.
Test sign-in, callback, return to the originating page, reload, and sign-out.
Login returns through the Star Rail callback to the originating Star Rail page.
Browser sessions stay separate per origin; the identity provider supplies SSO.
Authentication is independent of account imports.
There is no cloud account backup API or upload/download menu in this product.
Feedback and developer support are native Star Rail pages. Feedback sends an
ID token to the existing GGArtifact feedback API with cookies omitted and
`game: "HSR"`; both sites share `feedback_submissions`. Before publishing,
push GenshinTools first and wait for its Cloudflare deployment to succeed.
Its production `npm run build` automatically applies pending D1 migrations
(including `0006_feedback_game.sql`) before deploying the shared API. Then
publish this client. Historical feedback defaults to
GI. Production needs no new feedback service or database binding here.
For a local shared-API test, `VITE_FEEDBACK_API_ORIGIN` can override the default
`https://ggartifact.com`; set it to the local Genshin Worker origin at build time.

See [Logto's React integration guide](https://docs.logto.io/quick-starts/react).

## Automatic publishing

Connect `Anyrainel/GGStarRail` in Workers & Pages > ggstarrail > Settings >
Builds. Use production branch `main`, root directory `/`, Node 24 LTS, build
command `npm run build:cloudflare`, and deploy command `npx wrangler deploy`.
The Cloudflare project name must match the Wrangler name. Checks run before
deployment; failed validation prevents publishing. Keep preview branches from
using the production deploy command.

The domain is declared as a Worker Custom Domain in `wrangler.jsonc`.
Cloudflare manages its DNS and certificate. Normal releases use Git pushes;
`npm run deploy` is available for an explicitly requested manual deployment.

## Reproducible clean builds

`npm ci` / `npm install` installs tracked commit and push hooks in `.githooks` through
`prepare`. For an existing checkout, run `npm run prepare` once. Installation
refuses to overwrite a different `core.hooksPath`. Pushes require a clean tree
and run `git diff --check` plus the same complete `npm run check` used by CI
and Cloudflare; any nonzero exit blocks the push. Branch pushes must match the
checked-out commit so an unrelated clean checkout cannot validate them. The hook
rechecks HEAD and cleanliness after validation to reject concurrent edits or commits.
Git hooks can be bypassed,
so remote validation remains required.

The commit gate checks staged whitespace, lint, types, dependency boundaries,
hook regression tests, localization and UI conventions, related app tests,
and Worker checks when relevant. It does not rewrite or stash files and rejects
partially staged files so checks cannot validate a different version from the index.

`npm run depcheck` gates cycles, unresolved imports, domain/framework separation,
provider/state separation, credential boundaries, independent UI primitives,
store/UI separation, test-only imports, browser Node built-ins, and browser/Worker/tooling
isolation. It runs on commits, pushes, CI, and Cloudflare. These rules use
GGStarRail's own layers; GenshinTools game-specific checks are not applicable.

UI tests track real timeouts and intervals per test. After unmounting, teardown
allows 25 ms for deferred focus cleanup, then fails and cancels outstanding
timers with their scheduling stacks before jsdom is destroyed. Do not hide
leaks with blanket timer clearing or ignore unhandled errors. Await async work
and cancel component timers on unmount. This catches delayed callback leaks
without depending on local/CI execution speed; it cannot prove the absence of
every possible asynchronous bug.
Shared async UI assertions allow 5 seconds (tests default to 10 seconds) for
parallel catalog loading; this does not extend or bypass the timer-leak check.

```sh
npm ci
npm run data:restore
npm run assets:webp
npm run check
```

`data-bundle.lock.json` pins a public release archive by SHA-256 and source
revision. Restoring verifies its checksum, safe archive entries, reference
schema, member hashes, cross-file joins, and full image coverage before sync.
The source data and original PNGs remain outside Git history. Each release
archive includes the upstream attribution and provenance. Hosting the output
does not change the upstream license status or imply ownership of game art.

## Update game data

Run updates from the data producer, which writes the website JSON and scanner
cache into this checkout. GGStarRail does not need Python, a sibling producer
checkout, or a producer-root setting. See [the export contract](data-export-contract.md).
After receiving exports, run `npm run assets:webp` and `npm run check`.

To update the independently pinned legacy reference/PNG fallback, provide
reviewed bundles explicitly with `npm run data:sync -- --source DIR` and
`npm run assets:sync -- --source DIR`. A changed revision/schema or coverage
requires updating their audited consumer contracts. Then run
`npm run data:package` to create a new release archive and lockfile.

After validation, upload `test-results/hsr-data.tar.gz` to the release tag
printed by `npm run data:package` (do not replace an existing archive). Then
commit the updated lockfile and push. Cloud builds always use the reviewed
lockfile, never whatever upstream happens to publish during deployment.

## Cache and bundle design

- Page code loads on demand; React/router, Radix, drag-and-drop, validation,
  icons, and translations have separate chunks. Transitive dependencies stay
  with their importer to avoid React initialization cycles.
- The existing catalog members remain independent lazy chunks.
- Vite hashes JS, CSS, and the generated runtime image lookup. These URLs
  and content-addressed WebP URLs get one-year immutable browser caching.
- HTML revalidates. Extensionless HTML navigations receive the app shell;
  missing chunks and images return 404, including browser navigations.
- Static asset hits bypass Worker execution. The production build copies
  only the current referenced WebPs and logo, never the original PNG cache.
- WebP preserves dimensions and alpha, uses quality 85, and hashes encoded
  bytes. Encoding changes invalidate only affected image URLs. Code-only
  local builds validate and reuse existing WebP output.
- The development server also caches content-hashed WebPs so switching pages
  does not repeatedly revalidate every image.

Verify a release through its Cloudflare commit/build result, `/api/health`,
direct app-route navigation, image loading, and live response cache headers.
