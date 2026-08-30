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
- Worker name: `ggstarrail-worker`

There is no fallback to GenshinTools keys or backup formats. Unknown store
versions reset to a safe empty workspace; a future migration must be explicit,
pure, and fixture-tested.

## Locale model

UI messages live in separate `en` and `zh-CN` catalogs. English defines the
literal `MessageKey` union, and the Chinese catalog must satisfy the exact same
record type. Tests require non-empty translations and identical placeholders.

Domain records store stable definition IDs, Path IDs, Combat Type IDs, stat
IDs, and six HSR equipment slots. Display names belong to localized data
bundles, not account snapshots. Newly released Paths remain additive data: the
account schema accepts stable IDs rather than a closed English-name enum.

## State and backup

`useWorkspaceStore` persists source records and user-authored configuration
only. Actions and future derived caches are excluded through `partialize`.
Hydration parses the versioned payload with Zod.

Backups serialize a normalized, validated workspace inside a separately
versioned GGStarRail envelope. The serializer checks for credential-shaped
field names before producing JSON. Cloud transport is not implemented.

## Providers

Provider DTOs stay outside the canonical domain:

1. A provider validates its external envelope.
2. It converts to a locale-neutral `AccountImportDraft` or data manifest.
3. A future review layer presents safe warnings.
4. One store-owned action applies the accepted snapshot.

The current provider boundary includes:

- GIlore manifest validation only.
- GGStarRail scanner-envelope validation only.
- HoYoLAB injected transport with one-use credential handling only.

No provider performs a live network request in this foundation.

## Worker

The Worker is intentionally standalone and resource-free. It responds to
`GET`/`HEAD /api/health`, rejects mutations, and declares no D1, R2, KV, route,
cron, account, authentication provider, or secret configuration.
