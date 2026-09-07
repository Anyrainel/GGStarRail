# Architecture

## Design goals

GGStarRail follows the useful organizational and tooling ideas from
GenshinTools while keeping product identity, persisted data, assets, providers,
and infrastructure completely independent.

The browser application has one-way layers:

```text
domain + i18n + config
        ↓
pure libraries and provider adapters
        ↓
versioned Zustand stores and contexts
        ↓
UI primitives → shared components → layout
        ↓
route pages and App composition
```

Dependency Cruiser enforces the most important rules: the domain is
framework-free; providers cannot own UI or persistent state; persisted modules
cannot import the HoYoLAB credential module; browser code cannot use Node
built-ins; and the Worker cannot import the browser app.

## Product identity

Identity is centralized in `src/config/identity.ts`:

- package ID: `ggstarrail`
- app name: `GGStarRail`
- asset namespace: `/assets/ggstarrail`
- locale storage: `ggstarrail:locale:v1`
- workspace storage: `ggstarrail:workspace:v1`
- backup kind: `ggstarrail.backup`
- Worker name: `ggstarrail`

There is no fallback to GenshinTools keys or backup formats. The v1 to v2
workspace migration covers canonical account tri-state fields and the current
build/scoring model through the public hydration and backup paths. Unknown
store versions reset to a safe empty workspace; every later migration must
remain explicit, pure, and fixture-tested.

## Locale model

UI messages live in separate `en` and `zh-CN` catalogs. English defines the
literal `MessageKey` union, and the Chinese catalog must satisfy the exact same
record type. Tests require non-empty translations and identical placeholders.

Domain records store stable definition IDs, Path IDs, Combat Type IDs, stat
IDs, and six HSR equipment slots. Display names belong to localized data
bundles, not account snapshots. Newly released Paths remain additive data: the
account schema accepts stable IDs rather than a closed English-name enum.

## State and backup

`useWorkspaceStore` persists source records and user-authored build, scoring,
and triage configuration only. Actions and derived scoring/filter results are
excluded through `partialize`. Hydration parses the versioned payload with
Zod.

Backups serialize a normalized, validated workspace inside a separately
versioned GGStarRail envelope. The serializer checks for credential-shaped
field names before producing JSON. Cloud transport is not implemented.

## Providers

Provider DTOs stay outside the canonical domain:

1. A provider validates its external envelope.
2. It converts to a locale-neutral `AccountImportDraft` or data manifest.
3. The Account Data import review presents counts, source coverage, and safe
   warnings before applying.
4. Identity resolution distinguishes an empty workspace, the same UID, a
   different UID, and an unknown identity. A different UID requires confirmed
   replacement; an unknown identity requires an explicit merge or replacement
   choice.
5. One store-owned action applies the accepted merge or replacement.

The current provider boundary includes:

- verified GIlore reference-bundle sync and lazy catalog loaders;
- native GGStarRail, GOODScanner experimental v1/v2 and production v3, and
  interoperable HSR scanner-file adapters, with review-before-apply local file
  import and optional authoritative achievement completion;
- Enka raw with a separately normalized MiHoMo raw failover for public UID
  showcase data;
- separate Global and CN Battle Chronicle adapters with one-use credential
  handling and equipped-only inventory semantics.

The primary import action lives in Account Data and uses a responsive dialog.
The Data Sources route is secondary help and transport diagnostics, not a
required import step. Account source and section coverage remain visible in
Account Data, Scoring, Filters, and Triage so an equipped-only or showcase-only
snapshot cannot look like a complete inventory.

No GGStarRail provider performs a live network request for reference data.

## Worker

The Worker is intentionally standalone and storage-free. It responds to
`GET`/`HEAD /api/health`, a GET-only nine-digit UID route, and separate POST
routes for the Global and CN Battle Chronicle contracts. Paths, methods,
origins, bodies, upstream hosts, response sizes, and timeouts are allowlisted.
It serves the frontend through an ASSETS binding and the `hsr.ggartifact.com`
Custom Domain. It declares no D1, R2, KV, cron, authentication provider, or
secret binding. See [Account imports](account-imports.md) for coverage and
live-validation limits.
