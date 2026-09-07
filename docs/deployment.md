# Hosting and data updates

Production is a single Cloudflare Worker named `ggstarrail` at
https://hsr.ggartifact.com. It serves the Vite output and the existing `/api/`
import handlers. No database, bucket, or GenshinTools credentials are needed.

## Automatic publishing

Connect `Anyrainel/GGStarRail` in Workers & Pages > ggstarrail > Settings >
Builds. Use production branch `main`, root directory `/`, Node 22, build
command `npm run build:cloudflare`, and deploy command `npx wrangler deploy`.
The Cloudflare project name must match the Wrangler name. Checks run before
deployment; failed validation prevents publishing. Keep preview branches from
using the production deploy command.

The domain is declared as a Worker Custom Domain in `wrangler.jsonc`.
Cloudflare manages its DNS and certificate. Normal releases use Git pushes;
`npm run deploy` is available for an explicitly requested manual deployment.

## Reproducible clean builds

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

With `uv` and the sibling GIlore producer available:

```sh
npm run data:update
```

Set `GILORE_ROOT` to use a different producer checkout. This fetches the latest
TurnBasedGameData source, runs the producer's coverage checks, refreshes its
pinned StarRailRes image bundle, validates both consumer bundles, converts
every mapped PNG to WebP, and packages the new build inputs. A new source
revision/schema or changed coverage currently requires updating the audited
consumer contracts in `sync-hsr-reference.mjs` and `sync-hsr-assets.mjs`.
The script fails rather than accepting incompatible data or missing images.
It does not silently advance the producer's independently pinned image source.

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
