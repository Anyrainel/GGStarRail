# Source provenance

GGStarRail consumes GIlore's normalized `ggstarrail-reference` bundle without
renaming fields or replacing primary values. The audited local integration is
pinned to TurnBasedGameData revision
`014e33e2404f8cd668bf06fc2ea6db53b6bc3992`. The current application consumes
schema `1.1.0`; the validator also keeps explicit support for the legacy
`1.0.0` member/count contract. Other versions, including unknown `1.x`
minors, are rejected.

The primary TurnBasedGameData repository had no formal license declared at the
audited revision. Public access is not a license grant. GGStarRail preserves
Dimbreath attribution and source provenance, does not claim ownership, and
does not commit the normalized data or upstream asset corpus. Corroboration
evidence remains validation-only and never replaces a normalized value.

## Local generation and sync

`src/generated/hsr-reference/` is ignored local output. A fresh GGStarRail
checkout must first obtain a verified bundle; the GIlore commit alone does not
imply that its gitignored `data/` output exists.

From a sibling GIlore checkout, generate the pinned source bundle before
syncing:

```powershell
Set-Location ../GIlore
uv run python -m hsr_data reference --expected-revision 014e33e2404f8cd668bf06fc2ea6db53b6bc3992
Set-Location ../GGStarRail
npm run data:sync
```

The default sync input is
`../GIlore/data/reference/honkai_star_rail/v1`. A separately supplied bundle
can be used explicitly:

```powershell
npm run data:sync -- --source D:/verified/hsr-reference/v1
```

`npm run data:verify` verifies the source without publishing it.
`npm run data:check` verifies the ignored generated output used by the current
build. The full `npm run check` stack includes `data:check`.

## Accepted manifest and members

The consumer keeps GIlore's actual snake_case manifest contract:

- `bundle_id: ggstarrail-reference`;
- `game_id: honkai_star_rail`;
- exact supported `schema_version`;
- locales exactly `en`, `zh-CN`;
- primary source identity, immutable revision, version, and license status;
- raw `source_files` row counts and SHA-256 values;
- member `files` byte counts, entity counts, and SHA-256 values;
- audited cross-file `counts`.

Every member must repeat the manifest's bundle ID, game ID, schema version,
and source revision. The synchronization command verifies all bytes, hashes,
envelopes, collection identities, counts, stable-ID joins, bilingual text
identity, and diagnostics before touching generated output. It stages and
revalidates the complete result, publishes member files, and writes
`manifest.json` last. If publication fails, the previous generated directory
is restored.

Runtime loaders preserve that version boundary too. Legacy `1.0.0` Character
skills, Light Cone effects, progression tables, and property definitions keep
their original member shapes. They are exposed through schema-discriminated
catalogs and type guards; `1.1.0` ranks, Traces, servants, enhancement rows,
per-Superimposition text, progression items, and usable property icons are
only available after the matching guard. Missing additive families are never
fabricated as empty source data.

The audited catalogs contain 93 Characters, 169 Light Cones, 60 Relic/Planar
sets, 184 logical pieces represented by 742 rarity variants, 56 properties,
9 Paths, 7 combat types, and 6 slots. Schema 1.1 additionally preserves 611
base skills, 558 Eidolon ranks, 1,699 Trace nodes with 4,818 levels, seven
unique servants across eight character attachments with 48 unique skills, and
ten seasonal enhancement variants. Their 64 skills, 60 ranks, 180 Trace nodes,
and 500 Trace levels remain separate from the base forms. Every Light Cone has
all five Superimposition rows (845 total), including localized effect text,
parameters, properties, and rank-up material IDs. Progression includes 238
referenced items plus every declared XP, affix-roll, and source-derived scoring
table.

## Localization and diagnostics

Stable IDs remain language-neutral and case-sensitive. Each required text
stores independent `en` and `zh-CN` values plus TextMap key, locale, source
path, source revision, and source-reference provenance. Display helpers return
the selected value without discarding the underlying provenance.

The audited diagnostics contain zero unresolved mappings, four warning-level
source disagreements, and fourteen explicit source gaps. Missing optional
property labels and two skill tag/type labels remain `null`; scoring rows for
four non-exported character IDs remain present with
`character_exported=false`. A property icon sentinel remains preserved in the
raw `icon_path`, while schema 1.1 exposes `usable_icon_path: null` so asset
consumers do not treat the sentinel as a real image. No gap is filled from
corroboration or invented data.

Catalog JSON is loaded lazily per member so the roughly 25 MiB reference
bundle is not placed in the initial application chunk. A missing or invalid
generated bundle is a setup/build failure, never a silent fallback.

## Local asset snapshot

GIlore owns acquisition and normalization of the pinned StarRailRes snapshot.
GGStarRail does not contain another downloader. Generate the source asset
bundle after GIlore's reference bundle, then run both consumer sync commands:

```powershell
Set-Location ../GIlore
uv run python -m hsr_data assets --pull
Set-Location ../GGStarRail
npm run data:sync
npm run assets:sync
```

The default asset input is
`../GIlore/data/reference/honkai_star_rail/assets/v1`. `assets:sync` accepts an
explicit `--source` path, and `--reference` can point to the corresponding
reference manifest when verifying a separately staged pair. The companion
commands are:

- `npm run assets:verify` validates source bytes without publishing them;
- `npm run assets:check` validates the ignored cache and compact runtime
  lookup used by the app.

The asset consumer accepts only `ggstarrail-assets` schema `1.0.0`. It verifies
the sidecar digest, exact manifest identity and publication contract, linked
reference schema/revision/hash, immutable snapshot identity, safe relative
paths, every declared byte count and SHA-256, and every PNG signature and IHDR
dimension. It then stages and revalidates the copied snapshot before atomically
publishing it, with `assets-manifest.json` written as the cache marker last.
Failed validation leaves the previous cache intact.

The audited mapping covers all 93 Characters, 169 Light Cones, 60 Relic and
Planar sets, 184 logical Relic pieces representing 742 rarity variants, 9
Paths, 7 combat types, and 55 of 56 properties. The sole explicit exclusion is
`StanceBreakAddedRatio`, whose upstream icon is not real. These 577 logical
mappings resolve to 550 content-addressed PNG blobs. Six Relic slots and the
excluded property use deterministic generated text/shape fallbacks. A failed
image decode also switches to that visible fallback, so a missing file cannot
leave a silent broken-image grid. Property asset selection uses schema 1.1's
normalized `usable_icon_path`; the preserved raw `icon_path` sentinel is never
treated as a URL.

The full asset manifest is never imported into the application shell. Catalog
routes fetch a compact local lookup only when their data loads, then resolve
assets by stable ID through `configureCatalogAssetLookup`. The app never uses
upstream filenames or network URLs as an implicit fallback.

StarRailRes declares AGPL-3.0 for its repository, but that does not establish
rights to the underlying COGNOSPHERE game art. Its manifest therefore marks
public redistribution `not_cleared`. GGStarRail preserves the pinned project,
revision, upstream README, LICENSE, attribution, and license-scope notice, but
commits none of the binaries. The entire local output under
`public/assets/ggstarrail/cache/` is ignored and must not be published or
claimed as GGStarRail-owned content without a separate rights review.
