# GGStarRail contributor rules

- Keep this repository independent from GenshinTools. Architectural ideas may
  be reimplemented, but do not copy its game data, assets, imports, stores,
  migrations, engines, cloud code, identifiers, or secrets.
- Use HSR terms: Character, Light Cone, Relic, Planar Ornament, Eidolon,
  Superimposition, Trace, Path, Combat Type, Planar Sphere, and Link Rope.
- Keep stable IDs language-neutral. Every user-facing string belongs in the
  typed `en` and `zh-CN` catalogs.
- All persistent keys start with `ggstarrail:`. Do not add cross-product
  migration fallbacks.
- Authentication-cookie material is memory-only for one request. Never persist,
  export, back up, log, place in a URL, or attach it to an error object.
- Provider DTOs stay in `src/providers`; canonical state must not import them.
- Do not add team damage optimization, Genshin formula engines, or energy
  calculators without an explicit scope change.
- Production uses the `ggstarrail` Worker and `hsr.ggartifact.com`, with
  Cloudflare Git builds from `main`. Do not reuse GenshinTools cloud resources.
- Normal production publication is a validated push to `origin/main` when
  requested. Manual Wrangler deployment requires an explicit deployment request.
- Fresh clones run `npm run data:restore` and `npm run assets:webp` before
  checking. Publish the checksummed data release before pushing its lockfile.
- Run `npm run check` and `git diff --check` before committing.

## Project Layout And Commands

React 19 + TypeScript + Vite 7, Tailwind CSS 3, Radix primitives, Lucide, and
Zustand persist. Check `package.json` for the current command definitions.

- `npm run dev` starts Vite; `npm run dev:worker` starts the import Worker.
- `npm run type-check`, `npm run lint`, and `npm run depcheck` check types,
  Biome rules, and dependency boundaries.
- `npm run test` runs app/domain tests; `npm run test:worker` runs Worker tests.
- `npm run build` prepares WebP assets and builds the production app.
- `npm run check` runs the complete validation stack required before commits.
- `src/domain/` owns framework-free account, build, and Relic logic. Keep it
  independent of UI, stores, and providers.
- `src/providers/` owns external formats, adapters, and reference catalogs.
  Providers must not own UI or persisted state.
- `src/stores/` owns persisted state; `src/stores/migration/` owns store migrations.
- `src/components/shared/` and `src/components/ui/` hold reusable UI;
  `src/components/layout/` holds page shells and navigation UI.
- `src/lib/` holds app utilities; `src/i18n/` holds localization.
- `src/generated/` is generated input. Use the data/asset scripts rather than
  editing generated files. See `docs/source-provenance.md` and `docs/deployment.md`.
- `worker/` is standalone and must not import browser code from `src/`.
- `tests/` holds app/domain tests and fixtures; `tests/worker/` holds Worker tests.

## Page Map

Use `src/config/navigation.ts` for paths, `src/app/routeRegistry.ts` for page
labels, and `src/App.tsx` for the actual route components. The `artifact-builds`
directory name is used by the current HSR build UI; it is not a Genshin engine.

| Page | Route | Implementation |
| --- | --- | --- |
| Home | `/` | `src/pages/HomePage.tsx` |
| Characters | `/account-data/characters` | `src/pages/account-data/CharacterView.tsx` |
| Inventory | `/account-data/inventory` | `src/pages/account-data/InventoryView.tsx` |
| Resources | `/account-data/resources` | `src/pages/account-data/ResourceView.tsx` |
| Relic Triage | `/account-data/triage` | `src/pages/account-data/TriageView.tsx` |
| Character Builds | `/builds/configure` | `src/pages/artifact-builds/CharacterBuildView.tsx` |
| Relic Filters | `/builds/filters` | `src/pages/artifact-builds/ArtifactBuildsView.tsx` |
| Character Priority | `/tier-list/characters` | `src/pages/tier-list/CharacterTierListView.tsx` |
| Light Cone Priority | `/tier-list/light-cones` | `src/pages/tier-list/LightConeTierListView.tsx` |
| Relic Priority | `/tier-list/relics` | `src/pages/tier-list/RelicTierListView.tsx` |
| Archives | `/archive/characters`, `/archive/light-cones`, `/archive/relic-sets`, `/archive/achievements` | `src/pages/archive/ArchivePage.tsx` |
| Data Sources | `/data-sources` | `src/pages/DataSourcesPage.tsx` |

## UI And Localization

- Use `cn()` from `src/lib/utils.ts` for conditional Tailwind classes.
- Reuse shared components and fix recurring defects in the shared primitive.
- Use theme tokens from the existing ThemeContext/themeGenerator system rather
  than hardcoded UI colors. Do not add opacity to `text-muted-foreground` or
  `border-border`; keep controls and important information visible at rest.
- Use `AssetImage` / `ItemIcon` for catalog art and the helpers in
  `src/lib/assets.ts` for asset URLs. Preserve cache lookup and fallback behavior.
- Use `src/components/ui/responsive-dialog.tsx` for responsive dialogs and follow
  nearby callers for desktop/mobile interactions.
- Verify changed UI on its actual route at desktop and narrow widths, including
  relevant empty, populated, and interaction states.
- Add UI text to both `src/i18n/messages.en.ts` and `messages.zh-CN.ts` with
  matching keys and placeholders. Keep translation keys typed; do not build
  unchecked keys or cast arbitrary strings to bypass the catalog.
- Reuse localized catalog names and `src/i18n/gameTerms.ts` for game terminology.
  Chinese must use natural community wording and official HSR names.
- Public copy should explain player actions and outcomes. Keep implementation
  status, schema details, and architecture notes in contributor documentation.

## Error Handling And Imports

- Throw for impossible internal states or corrupted bundled data. Use `null`
  only for expected absence or a normal infeasible result.
- For recoverable parsing, validation, network, and batch failures, use the
  existing domain-specific unions/results so callers can act on the cause.
  Do not introduce a repo-wide generic `Result<T>` abstraction.
- Preserve partial successes and import warnings. Do not silently turn a failed
  import into empty data or mutate the account before validation and review.
- Preserve source coverage and account-identity checks. A public showcase or
  equipped-gear response is not a full inventory; missing records in a partial
  import must not delete richer data for the same account.
- Report failures near the action using the existing localized error, dialog,
  or empty-state pattern. Keep useful diagnostics while redacting credentials.
- Consult `docs/account-imports.md` and `docs/security.md` before changing import,
  merge, backup, or credential handling.

## Store And Data Migrations

Before changing persisted stores, imports, conversions, or equipment mutations,
inspect the relevant schema, store, migration, and nearby tests.

- Treat changes to persisted meaning as schema changes, even if the field type
  stays the same: renamed IDs, score scales, units, enum meanings, and saved
  defaults all count.
- If a smooth migration is not possible, discuss options before implementing.
- Version affected persisted formats and document the old shape at the migration
  site. Compare against the current origin version and consolidate local changes
  into the existing unpublished version bump where appropriate.
- Preserve user choices; do not use a changed default to overwrite saved settings.
- Apply compatible transforms at every existing boundary carrying the data,
  including store hydration, backup parsing, and build/account import-export.
  Invalidate derived caches that cannot be reconciled safely.
- Test realistic old persisted fixtures through public hydration/import paths,
  including all supported older versions. Fresh current-state fixtures alone
  do not establish migration coverage.
- Keep store migration logic and old store schemas under `src/stores/migration/`.
  For ordinary refactors, migrate callers to the source of truth and remove old
  paths instead of adding internal re-export compatibility shims.

## Code, Testing, And File Safety

- Keep domain logic, provider formats, and UI models in their respective layers;
  enforce the rules in `.dependency-cruiser.cjs` rather than bypassing them.
- Import from the module that owns the implementation. Avoid re-export barrels
  and unrelated additions to broadly named utility modules.
- Use the `@/` alias for app imports in tests and follow nearby test conventions.
- For expensive tests or benchmarks with long output, redirect output to a
  task-specific file under `test-results/`, inspect it, then remove that file.
- Before risky bulk edits, back up the target. Write bulk transformations to a
  `.new` or `.tmp` file, inspect the diff, then replace the source. Dry-run regex
  transformations before applying them.

## Shared Workspace And Git Safety

- Treat unexpected pending or staged files as someone else's work. Preserve them.
- Never use `stash`, `reset --hard`, `restore`, or `checkout --` as cleanup unless
  explicitly requested. Do not delete another process's Git lock.
- Do not use partial staging to separate changes in a shared file. Coordinate
  overlapping edits; preserving pending work matters more than tidy boundaries.
- Once a self-contained change is validated, stage the intended files and commit
  proactively. Inspect the index first so unrelated staged changes are not
  accidentally included.
- Pushing remains opt-in because `origin/main` auto-deploys production. The
  production and manual-deploy rules above still apply.
