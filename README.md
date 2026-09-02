# GGStarRail

GGStarRail is a local-first Honkai: Star Rail account, inventory, build, and
relic-triage workspace. This repository contains an independent application
foundation; it does not contain GenshinTools game engines, data, assets,
imports, persisted schemas, or cloud resources.

The UI ships with typed English and Simplified Chinese catalogs from the first
commit. Gameplay records use stable IDs, so switching languages never changes
stored data or requires a schema migration.

## Quick start

```powershell
npm install
npm run data:sync
npm run assets:sync
npm run demo:start
```

`data:sync` verifies the normalized bundle in the sibling GIlore checkout and
publishes it to the ignored local generated-data directory. On a fresh clone,
generate GIlore's gitignored bundle first or pass an explicit verified bundle
path; see [Source provenance](docs/source-provenance.md).

`assets:sync` consumes GIlore's separately generated, content-addressed asset
bundle. It writes only to an ignored local cache; no upstream game-art binary
is committed by GGStarRail.

`demo:start` leaves a detached local demo at `http://127.0.0.1:41737`, so it
stays available after the launching terminal closes. It validates the page
identity before reusing a listener and writes timestamped logs under
`%TEMP%\ggstarrail-demo`; it is not a reboot-persistent Windows service. Use
`npm run dev` for an attached Vite session on its default port. The placeholder
Worker can be run separately with `npm run dev:worker`; it exposes only
`GET /api/health` and has no live bindings.

## Developer commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the React/Vite app |
| `npm run demo:start` | Start or reuse the detached demo on port 41737 |
| `npm run dev:worker` | Start the resource-free Worker shell |
| `npm run data:sync` | Verify and import the sibling GIlore reference bundle |
| `npm run data:verify` | Verify the source bundle without publishing it |
| `npm run data:check` | Verify the ignored generated bundle used by the app |
| `npm run assets:sync` | Verify and copy GIlore's local HSR asset bundle |
| `npm run assets:verify` | Verify asset source bytes without publishing them |
| `npm run assets:check` | Verify the ignored asset cache and runtime lookup |
| `npm run build` | TypeScript project build plus Vite production build |
| `npm run type-check` | Check app, tooling, and Worker test projects |
| `npm run lint` | Run Biome without writing |
| `npm run lint:fix` | Apply Biome formatting and safe fixes |
| `npm run test` | Run browser/domain tests |
| `npm run test:worker` | Run Worker tests in Node |
| `npm run depcheck` | Enforce dependency boundaries |
| `npm run check:worker` | Validate, type-check, and test the Worker shell |
| `npm run check` | Run the complete local validation stack |

There is intentionally no deployment command in the foundation.

## Honest product boundary

Implemented now:

- React 19, TypeScript, Vite, Tailwind, shadcn-style primitives, and Zustand.
- Responsive desktop/mobile shell and all MVP routes.
- Typed `en` and `zh-CN` catalogs with key and placeholder parity tests.
- Locale-neutral HSR account, Character, Light Cone, and six-slot Relic models.
- Versioned local workspace storage and a GGStarRail-only backup envelope.
- Pure, user-weighted scoring; computed-filter evaluation; advisory triage.
- Complete, lazily loaded GIlore reference catalogs with strict integrity,
  provenance, diagnostics, and bilingual-identity checks.
- Functional Character, Light Cone, and Relic/Planar Archives with localized
  search, filters, selectable details, progression, materials, and provenance.
- Functional local Account Data inventory views plus an explicit real-ID demo
  account loader.
- Review-before-apply JSON import for the native GGStarRail envelope and the
  isolated GOODScanner HSR experimental envelope; rejected imports are atomic.
- Deterministic local GIlore sync plus strict scanner-envelope validation.
- Complete local asset-cache resolution with deterministic visual fallbacks.
- One-use, memory-only HoYoLAB authentication-material boundary.
- Redacted error handling, a binding-free Worker health endpoint, and tests.

Scaffolded, not connected:

- Live scanner capture and a production scanner-to-GGStarRail handoff.
- HoYoLAB request transport, credential UI, and upstream response conversion.
- Build/profile editors, product-calibrated scoring presets, and triage
  controls beyond the transparent source-derived tables in this prototype.
- Backup file UI, authentication, cloud backup, Worker storage, or secrets.

Explicitly excluded:

- Team damage optimization.
- Any Genshin damage or artifact engine.
- Energy calculators.

## Documentation

- [Architecture](docs/architecture.md)
- [MVP scope](docs/mvp-scope.md)
- [Source provenance](docs/source-provenance.md)
- [Security and imports](docs/security.md)
- [Follow-up milestones](docs/milestones.md)
- [简体中文说明](README.zh-CN.md)
