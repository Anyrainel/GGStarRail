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
npm run dev
```

The Vite app defaults to `http://localhost:5173`. The placeholder Worker can be
run separately with `npm run dev:worker`; it exposes only `GET /api/health` and
has no live bindings.

## Developer commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the React/Vite app |
| `npm run dev:worker` | Start the resource-free Worker shell |
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
- GIlore manifest and GGStarRail scanner-envelope validation contracts.
- One-use, memory-only HoYoLAB authentication-material boundary.
- Redacted error handling, a binding-free Worker health endpoint, and tests.

Scaffolded, not connected:

- Real GIlore-generated HSR catalogs, localized text, or game assets.
- Scanner file picker, import review/merge UI, and an actual scanner adapter.
- HoYoLAB request transport, credential UI, and upstream response conversion.
- Archive records, build/profile editors, product-calibrated scoring presets,
  and triage controls.
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
