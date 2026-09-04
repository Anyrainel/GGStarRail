# GGStarRail

GGStarRail is a local-first Honkai: Star Rail account, inventory, build, and
relic-triage workspace. This repository contains an independent application;
it does not contain GenshinTools game engines, data, assets,
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
`npm run dev` for an attached Vite session on its default port. The local
Worker can be run separately with `npm run dev:worker`; it exposes the health
check plus tightly allowlisted account-import proxy routes and has no storage
bindings.

## Developer commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the React/Vite app |
| `npm run demo:start` | Start or reuse the detached demo on port 41737 |
| `npm run dev:worker` | Start the local account-import Worker |
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
| `npm run check:worker` | Validate, type-check, and test the Worker |
| `npm run check` | Run the complete local validation stack |

There is intentionally no deployment command in this project.

## Honest product boundary

Implemented now:

- React 19, TypeScript, Vite, Tailwind, shadcn-style primitives, and Zustand.
- Responsive desktop/mobile shell and all MVP routes.
- Typed `en` and `zh-CN` catalogs with key and placeholder parity tests.
- Locale-neutral HSR account, Character, Light Cone, six-slot Relic, and
  optional achievement-completion models.
- Versioned local workspace storage and a GGStarRail-only backup envelope.
- Editable per-Character 4+2 builds, with an advanced 2+2 Cavern alternative,
  fixed Head/Hands main stats, and configurable main stats for the other four
  slots.
- Editable scoring profiles backed by generated HSR affix tables, normalized
  per-Relic and equipped-build scores, grades, derived filters, recommendations,
  and advisory triage.
- Complete, lazily loaded GIlore reference catalogs with strict integrity,
  provenance, diagnostics, and bilingual-identity checks.
- Functional Character, Light Cone, Relic/Planar, and Achievement Archives
  with localized search, filters, selectable details, progression, materials,
  completion coverage, and provenance.
- Functional Account Data views with a primary responsive import action for
  public UID, transient HoYoLAB/米游社 credentials, and scanner JSON. The
  explicit real-ID demo loader remains a secondary development aid.
- Review-before-apply JSON import for the native GGStarRail envelope,
  GOODScanner HSR experimental v1/v2 and production v3, and interoperable
  Reliquary, HSR-Scanner, Kel, and Fribbels v4 files; rejected imports are
  atomic. Production v3 may authoritatively replace achievement completion
  while omitted achievement evidence remains unavailable and preserves local
  progress during a merge.
- Deterministic local GIlore sync plus strict scanner-envelope validation.
- Complete local asset-cache resolution with deterministic visual fallbacks.
- Enka/MiHoMo public showcase import and separate Global/CN Battle Chronicle
  adapters with prominent section coverage and non-destructive partial
  merging. Unknown account identity requires an explicit merge or replacement
  choice, and a different UID requires confirmed replacement.
- One-use, memory-only HoYoLAB authentication-material handling through a
  no-storage local Worker boundary.
- GOODScanner manager preview/export for lock and discard-mark review; the site
  never claims to mutate the game.
- Redacted error handling, fixture-backed Worker routes, migrations, and tests.

Known external boundaries:

- Authenticated Battle Chronicle success and the minimum accepted cookie fields
  remain unverified without a user-authorized credential test.
- Browser/app verification challenges must be completed in HoYoLAB or 米游社;
  GGStarRail does not automate them.
- Full-workspace backup file UI, authentication, cloud backup, Worker storage,
  or production secrets.

Explicitly excluded:

- Team damage optimization.
- Any Genshin damage or artifact engine.
- Energy calculators.

## Documentation

- [Architecture](docs/architecture.md)
- [MVP scope](docs/mvp-scope.md)
- [Source provenance](docs/source-provenance.md)
- [Security and imports](docs/security.md)
- [Account import contracts](docs/account-imports.md)
- [Follow-up milestones](docs/milestones.md)
- [简体中文说明](README.zh-CN.md)
