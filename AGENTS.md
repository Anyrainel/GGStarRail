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
- Team damage simulation and optimization are in scope (`src/domain/combat`,
  `docs/combat/`). Energy and Skill Points belong inside the battle timeline,
  not in standalone calculators. Do not add Genshin formula engines.
- Production uses the `ggstarrail` Worker and `hsr.ggartifact.com`, with
  Cloudflare Git builds from `main`. Do not reuse GenshinTools cloud resources.
- Normal production publication is a validated push to `origin/main` when
  requested. Manual Wrangler deployment requires an explicit deployment request.
- Fresh clones run `npm run data:restore` and `npm run assets:webp` before
  checking. Publish the checksummed data release before pushing its lockfile.
- Run `npm run check` and `git diff --check` before committing.
- `npm ci` / `npm install` installs `.githooks` via `prepare`; existing checkouts
  can run `npm run prepare`. Commits gate lint, types, dependency boundaries,
  conventions and related tests; pushes run the full validation stack against
  a clean, unchanged HEAD. Do not bypass the hooks to publish failing changes.

## Repository architecture

The authoritative target layout and dependency rules are in
[docs/architecture.md](docs/architecture.md). That document supersedes older
general folder descriptions. Read it before reorganizing modules.

Command definitions live in `package.json`; `npm run check` is the complete
validation stack. Combat kit work follows `.agents/skills/hsr-combat/`; use
`combat-agents` for translation workers and `npm run combat:dossier -- C|L|R <id>`
for source dossiers. Operational data/asset rules are in
`docs/source-provenance.md` and `docs/deployment.md`.

## Page Map

Use `src/config/navigation.ts` for paths, `src/app/routeRegistry.ts` for page
labels, and `src/app/App.tsx` for the actual route components.

| Page | Route | Implementation |
| --- | --- | --- |
| Home | `/` | `src/pages/HomePage.tsx` |
| Characters | `/account-data/characters` | `src/pages/game-account/CharacterView.tsx` |
| Inventory | `/account-data/inventory` | `src/pages/game-account/InventoryView.tsx` |
| Resources | `/account-data/resources` | `src/pages/game-account/ResourceView.tsx` |
| Relic Triage | `/account-data/triage` | `src/pages/game-account/TriageView.tsx` |
| DMG Optimizer | `/team-damage/optimizer` | `src/pages/teams/TeamDamagePage.tsx` |
| Investment | `/team-damage/investment` | `src/pages/teams/TeamDamagePage.tsx` |
| Light Cone & Relic Choice | `/team-damage/choice` | `src/pages/teams/TeamDamagePage.tsx` |
| Character Builds | `/builds/configure` | `src/pages/builds/CharacterBuildView.tsx` |
| Relic Filters | `/builds/filters` | `src/pages/builds/RelicFiltersView.tsx` |
| Character Priority | `/tier-list/characters` | `src/pages/tier-list/CharacterTierListView.tsx` |
| Light Cone Priority | `/tier-list/light-cones` | `src/pages/tier-list/LightConeTierListView.tsx` |
| Relic Priority | `/tier-list/relics` | `src/pages/tier-list/RelicTierListView.tsx` |
| Archives | `/archive/characters`, `/archive/light-cones`, `/archive/relic-sets`, `/archive/achievements`, `/archive/currency-war` | `src/pages/archive/ArchivePage.tsx` |
| Scanner download | `/download-scanner` | `src/pages/ScannerDownloadPage.tsx` |
| Not found | `*` | `src/pages/NotFoundPage.tsx` |

## UI And Localization

### Shared UI Entry Points

| Need | Source of truth |
| --- | --- |
| Theme colors and surfaces | `src/index.css`, `src/lib/theme/generator.ts`: use `bg-background`, `text-foreground`, `bg-primary`, `bg-gradient-card`, `bg-gradient-select` |
| Dynamic Combat Type, rarity and Tier classes | `src/components/shared/colors.ts`: `getCombatTypeColor(id, "text")`, `getRarityColor(rarity, "gradient")`, `getTierColor(tier, "header")`; compose with `cn()` |
| Game palettes / raw chart colors | `src/config/gameColors.ts`; `src/lib/game/colors.ts` exposes actual CSS values for non-DOM consumers. Change values in the palette, not in individual components |
| Item identity and filter controls | `src/components/shared/ItemIcon.tsx`, `AssetImage.tsx`, `FilterChip.tsx`, `FilterChipGroup.tsx` |
| Page structure | `src/components/layout/{PageLayout,SidebarLayout,WideLayout,ScrollLayout,SidebarDetailLayout}.tsx`; inspect a sibling page before creating a scroll shell |
| Responsive dialogs | `src/components/ui/responsive-dialog.tsx` and its existing callers |

- Use complete literal Tailwind classes or the typed helpers; never interpolate color class names (such as `text-combat-${id}`).
- `getRarityColor(rarity, "bg")` is a solid accent; `"text"` is the readable foreground; `"gradient"` is the item artwork background. Preserve their distinct palettes. Unknown Combat Type/group IDs use neutral inherited styling; missing item rarity uses the neutral gradient.
- `bg-item-badge`, `text-item-badge-foreground`, `bg-item-level` and `text-item-level-foreground` are item chrome tokens; use `ItemIcon` to compose them.
- UI invariant tests reject new literal colors, interpolated color utilities, and opacity on `text-muted-foreground` / `border-border` in components and pages (including adjacent CSS). Existing debt is capped by exact file/rule/fragment counts in `tests/fixtures/ui-invariants-baseline.json`; remove entries when fixing debt, never expand it to make a new violation pass. Dedicated chart palettes belong in the color definition module.

- Player-facing update history lives in `src/content/updatelog/{en,zh-CN}.md`
  and is opened by the home page Pac-Man. Follow `docs/update-log.md`: draft
  bilingual entries for review before writing them, and update only on request.

- Use `cn()` from `src/lib/utils.ts` for conditional Tailwind classes.
- Reuse shared components and fix recurring defects in the shared primitive.
- Every route must use a shared content layout, including loading, error and
  empty states: `ScrollLayout` for flowing content, `SidebarLayout` for filters,
  `SidebarDetailLayout` for browse/detail, or `WideLayout` for dense tables.
  `PageLayout` is a bounded shell, not a scroller. Keep any wrapper between it
  and the content layout bounded (`h-full min-h-0` or `flex-1 min-h-0` in a flex
  column); an auto-height wrapper can expand a scroller beyond the viewport.
  Preserve all five layout primitives and their capabilities when evolving UI.
  Verify actual scrolling to the last content at desktop and narrow widths.
- Use theme tokens from the existing ThemeContext/themeGenerator system rather
  than hardcoded UI colors. Do not add opacity to `text-muted-foreground` or
  `border-border`; keep controls and important information visible at rest.
- Use `AssetImage` / `ItemIcon` for catalog art and the helpers in
  `src/lib/assets/urls.ts` for asset URLs. Preserve cache lookup and fallback behavior.
- Use `src/components/ui/responsive-dialog.tsx` for responsive dialogs and follow
  nearby callers for desktop/mobile interactions.
- Verify changed UI on its actual route at desktop and narrow widths, including
  relevant empty, populated, and interaction states.
- Add UI text to both `src/i18n/messages.en.ts` and `messages.zh-CN.ts` with
  matching keys and placeholders. Keep translation keys typed; do not build
  unchecked keys or cast arbitrary strings to bypass the catalog.
- Reuse localized catalog names and `src/i18n/gameTerms.ts` for game terminology.
  Chinese must use natural community wording and official HSR names.
- Do not add explanatory or instructional UI copy; make the interface self-explanatory through intuitive UX design, and reserve supporting text for rules and restrictions.
- Keep implementation status, schema details, and architecture notes in contributor documentation.

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
