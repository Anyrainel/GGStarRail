# Dependency migration — 2026-10-12

Requested releases were verified against npm registry metadata before installation.
Direct dependencies use exact versions so CI and deployment use the reviewed graph.

| Tool | Version |
| --- | --- |
| Node requirement | 24 LTS (`>=24 <25`, CI 24, `.node-version`) |
| React / React DOM / types | 19.3.0 |
| TypeScript | 7.0.2 |
| Vite / React plugin | 8.3.4 / 6.1.2 |
| Tailwind / Vite integration | 4.3.3 |
| tw-animate-css / radix-ui | 1.4.0 / 1.8.0 |
| Vitest / coverage-v8 | 5.0.3 |
| Wrangler | 4.149.0 |
| Cloudflare Vite / Vitest plugins | 1.63.1 / 1.4.0 |
| Biome / dependency-cruiser | 2.5.15 / 18.6.0 |
| Playwright | 1.64.0 |

Other direct packages use their latest compatible stable registry releases.
Vitest stays at the explicitly requested 5.0.3 even though 5.0.4 is available;
Node types stay on 24.19.2 to describe the required Node major. No old TypeScript
package or compatibility compiler is retained. `npm ls typescript --all` confirms
the whole installed graph uses 7.0.2.

TypeScript 7 removes the JavaScript compiler API. The UI invariant AST guard now
uses Babel's TypeScript parser. Dependency-cruiser uses its supported SWC parser,
with a supported resolver config deriving aliases from `tsconfig.app.json`.
Architecture negative fixtures and safe explicit/named type-only imports verify
the distinction between domain contracts and runtime dependencies. The resolver
does not invoke the old compiler API. SWC remains a direct tooling dependency for
architecture checks; Vite uses its current React plugin and native transform.

Tailwind is CSS-first, using `@tailwindcss/vite`, inline runtime theme variables,
native utilities and `tw-animate-css`. The maintained game palette generates
`src/generated/game-palette.css`, guarded by `styles:check`. There is no legacy
`@config` or `@plugin`, PostCSS Tailwind adapter, or Tailwind 3 config. Independent
compiled-CSS tests verify colors, rarity gradients, container/radius behavior and
Radix accordion animations. See the [Tailwind upgrade guide](https://tailwindcss.com/docs/upgrade-guide).

Seven official shadcn bases were refreshed, with their URLs and hashes recorded
in `shadcn-stock.json`. Stock hashes fail on edits. Existing approved fixes remain
in shared wrappers, and custom primitives are retained. See the separate
shadcn audit and recorded patch; no additional local base modification is kept.

The [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
unifies browser and Worker development and builds `dist/client` plus the Worker
output. Public assets are copied and filtered before Cloudflare finalizes its
assets. Asset byte checks, obsolete/source-image exclusion, SPA navigation and
missing-asset 404 checks remain required. Deployment uses the normal Git build.

Wrangler generates full runtime and binding declarations. `types:worker` trims
upstream trailing whitespace; `check:worker-types` uses Wrangler's drift check.
The generic Workers type package is removed. Worker tests retain useful Node
units and add real workerd integration with [MSW](https://developers.cloudflare.com/workers/testing/vitest-integration/mock-outbound-requests/).
These exposed workerd's unsupported `redirect: "error"`: manual redirects now
reject 3xx explicitly, with a credential redirect regression test.

Validation: required `npm run check`, production build, asset verification, type
drift, 1,020 app tests, 23 Node Worker tests, 10 runtime Worker tests, and four
desktop/mobile built-browser cases. See the browser coverage audit for scanner
fixture provenance, persistence, localization and all six theme checks. The
installed Git hooks run independently at commit/push. No game data or persisted
schema was changed by this migration.
