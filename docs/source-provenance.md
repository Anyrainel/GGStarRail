# Source provenance

GGStarRail consumes the normalized `ggstarrail-reference` bundle without
renaming fields or replacing primary values. The audited local integration is
pinned to producer commit
`7ef3650a63622c204b89234406c99dc221e01d85` and TurnBasedGameData source
revision `8cdb905dc2f8e6fffa9be4eb07af3e34435d6091`. The current application
consumes schema `1.2.0`; the validator also keeps explicit support for the
legacy `1.0.0` and `1.1.0` member/count contracts. Other versions, including
unknown `1.x` minors, are rejected. The audited manifest SHA-256 is
`9899cc8fdde578cdbd744ec9f8b2705cd2f11d43670232e871f489fc3d549b5f`.

The primary TurnBasedGameData repository had no formal license declared at the
audited revision. Public access is not a license grant. GGStarRail preserves
Dimbreath attribution and source provenance, does not claim ownership, and
does not commit the normalized data or upstream asset corpus. Corroboration
evidence remains validation-only and never replaces a normalized value.

## Local generation and sync

`src/generated/hsr-reference/` is ignored local output. A fresh GGStarRail
checkout runs `npm run data:restore` to obtain the checksummed release pinned
in `data-bundle.lock.json`, followed by `npm run assets:webp`. Maintainers may
instead receive a verified bundle from the producer. See
[Hosting and data updates](deployment.md). Sync always requires an explicit
source directory; no sibling repository is discovered:

```powershell
npm run data:sync -- --source D:/verified/hsr-reference/v1
```

`npm run data:verify -- --source DIR` verifies the source without publishing it.
`npm run data:check` verifies the ignored generated output used by the current
build. The full `npm run check` stack includes `data:check`.

## GOODScanner achievement import boundary

Production achievement captures use `schema: "goodscanner.hsr"` with
`schemaVersion: 3`. The optional top-level `achievements` member has its own
packet-capture source and accepts only a safe 1–128 character ASCII revision,
`coverage: "complete"`, and sorted unique entries shaped as a numeric nonzero
u32 `achievementId` plus `status: "completed"`. IDs are checked against the
loaded schema 1.2 achievement reference before any account mutation.

Achievement coverage is independent from inventory coverage. An omitted
`achievements` member means completion was not observed and a merge preserves
the existing completion state. A present complete member is authoritative and
replaces only the completed-ID set; an empty `entries` array therefore records
a confirmed zero and clears only achievement completion. Unknown schema
versions, source kinds, coverage values, statuses, duplicate or unsorted IDs,
unsafe revisions, unknown reference IDs, and extra fields are rejected rather
than reinterpreted. The import never accepts account/session/device identifiers,
timestamps, progress, raw protocol status, or packet bytes in achievement
evidence.

## Accepted manifest and members

The consumer keeps the producer's actual snake_case manifest contract:

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
only available after the matching guard. Schema `1.2.0` adds separate
`achievement_categories.json` and `achievements.json` members with numeric
nonzero-u32 IDs, localized visibility-aware text, chain metadata, completion
conditions, and reward definitions. Missing additive families are never
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
table. Schema 1.2 adds 1,921 achievements in nine categories. Of those, 806
hide their title and every description until completion, 310 expose an
alternate pre-completion description, all current chains are singleton, and
none has source-provided release-version data. The category and achievement
member SHA-256 values are
`bee059be3811dd98f893e5f066678e531099262670bd8e022a588c8cd5465f70` and
`361a8825eee06b0614c94101b26574d5c619140665bc03a0172ab832dc53fd78`.

## Localization and diagnostics

Stable IDs remain language-neutral and case-sensitive. Each required text
stores independent `en` and `zh-CN` values plus TextMap key, locale, source
path, source revision, and source-reference provenance. Display helpers return
the selected value without discarding the underlying provenance.

The audited diagnostics contain zero unresolved mappings, four warning-level
source disagreements, and sixteen explicit source gaps. Missing optional
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

The producer owns acquisition and normalization of the pinned StarRailRes snapshot.
GGStarRail does not contain another downloader. Receive the corresponding
reference and asset bundles, then run both consumer sync commands:

```powershell
npm run data:sync -- --source D:/verified/hsr-reference/v1
npm run assets:sync -- --source D:/verified/hsr-assets/v1
```

`assets:sync` requires an explicit `--source` path, and `--reference` can point to the corresponding
reference manifest when verifying a separately staged pair. The companion
commands are:

- `npm run assets:verify -- --source DIR` validates source bytes without publishing them;
- `npm run assets:check` validates the ignored cache and compact runtime
  lookup used by the app.

The asset consumer accepts only `ggstarrail-assets` schema `1.1.0`. It verifies
the sidecar digest, exact manifest identity and publication contract, linked
reference schema/revision/hash, immutable snapshot identity, safe relative
paths, every declared byte count and SHA-256, and every PNG signature and IHDR
dimension. It then stages and revalidates the copied snapshot before atomically
publishing it, with `assets-manifest.json` written as the cache marker last.
Failed validation leaves the previous cache intact.

The audited mapping covers all 93 Characters, 169 Light Cones, 60 Relic and
Planar sets, 184 logical Relic pieces representing 742 rarity variants, 9
Paths, 7 combat types, 55 of 56 properties, and the Stellar Jade achievement
reward. The sole property exclusion is `StanceBreakAddedRatio`, whose upstream
icon is not real. Per-achievement IDs are validated against all 1,921
definitions but are not mapped because StarRailRes has no exact indexed icon;
the nine category icons are explicit no-exact-index exclusions. These 578
logical mappings resolve to 551 content-addressed PNG blobs. Six Relic slots,
achievement rows/categories, and the excluded property use deterministic
generated text/shape fallbacks. A failed image decode also switches to that
visible fallback, so a missing file cannot leave a silent broken-image grid.
Property asset selection uses schema 1.1's normalized `usable_icon_path`; the
preserved raw `icon_path` sentinel is never treated as a URL. The audited asset
manifest SHA-256 is
`835203c0d78e71125bac8d752c57dbb8e393d2c3af7ec6dcb78b74b42665dd19`.

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

## Currency War catalog artwork

Currency War IDs, localized text, mechanics, and archive membership come from
the producer's checksummed TurnBasedGameData reference members. Nanoka's Currency War
JSON is used to investigate source relationships, not as a replacement for those
primary values. The website obtains catalog artwork separately from Nanoka's
`assets/hsr/gridfight/` image endpoints using each normalized record's datamine
icon path.

`node scripts/currency-war-assets.mjs` validates the four normalized member
checksums and source revisions, maps supported icon namespaces, and adds the
content-hashed WebPs to `data/source-assets/`. Each manifest entry preserves the
source URL, source image checksum, WebP checksum, and encoded byte count. The
tracked source-asset restore step adds these four asset kinds to the runtime
lookup, so archive pages serve local artwork through the usual asset helpers.
The producer's source refresh includes acquisition; cached preparation only verifies existing
artwork and fails if an image is missing. A previously unknown icon namespace
also fails for explicit review instead of generating an unverified URL.

The tracked Light Cone source WebPs retain their original artwork. During
`assets:webp`, the runtime copies are resized to at most 384 px wide and encoded
at WebP quality 75. The app displays them at no more than 80 CSS px wide; the
runtime files use content-hashed paths so a conversion change invalidates old
browser caches. Character and Relic artwork keeps its existing dimensions and
encoding.

## Home card publisher wallpapers

The four curated images in `public/assets/ggstarrail/home/` come directly from
the verified Honkai: Star Rail publisher account on HoYoLAB. Each source post
displays "Repost allowed". They are COGNOSPHERE artwork, not GGArtifact-owned
art or assets covered by this repository's code license. The original images
retain their publisher marks; local copies are resized to 1400 px wide and
encoded as WebP (quality 86) without retouching. Cards use CSS cover crops.

| Local file | Official post | Original image |
| --- | --- | --- |
| `firefly.webp` | [Outfit Wallpaper: Firefly, Spring Missive](https://www.hoyolab.com/article/39526862) | [2560 x 1440 JPG](https://upload-os-bbs.hoyolab.com/upload/2025/06/20/99ff1c2471c15e840f4b4c57aff036df_4595423145747539859.jpg) |
| `ruan-mei.webp` | [Pom-Pom Gallery, December 15, 2023](https://www.hoyolab.com/article/23629548) | [2844 x 1600 JPEG](https://upload-os-bbs.hoyolab.com/upload/2023/12/15/95e2d452ec9a06140ca4bd7c50127167_4472802937747563065.jpeg) |
| `hysilens.webp` | [Pom-Pom Gallery, September 4, 2025](https://www.hoyolab.com/article/40908393) | [1920 x 1080 JPG](https://upload-os-bbs.hoyolab.com/upload/2025/08/22/aac7a06d63e1f2d9ee26ee975977e893_6439837002613710400.jpg) |
| `evernight.webp` | [Pom-Pom Gallery, September 4, 2025](https://www.hoyolab.com/article/40908393) | [1920 x 1080 JPG](https://upload-os-bbs.hoyolab.com/upload/2025/08/22/fc2a791fa9be6524f095e0586b8ac84f_2383941123723856191.jpg) |

The Ruan Mei source also includes Dr. Ratio and a small Herta; the card focuses
on Ruan Mei. The other three images each feature a single character. Sources
and original dimensions were verified on September 7, 2026.

## GGArtifact hero wordmark

`public/assets/ggstarrail/wordmark.svg` is an original vector drawing of the
GGArtifact name. Its angular slanted letterforms, blue/gold crescent, and
ascending Express motif reference the English Star Rail wordmark displayed
on the [official site](https://hsr.hoyoverse.com/en-us/), inspected September 7,
2026. It uses custom paths rather than a bundled game logo or font. The
separate Stellar Jade site icon remains the switcher mark and favicon.
