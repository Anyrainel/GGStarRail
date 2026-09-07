# GIlore website export contract

GIlore owns normalized numeric/string exports. GGStarRail owns the public-source
crawlers and consumes generated files. GenshinTools retains its existing separate
GIlore `anime_game_data reference` exporter and application contract.

## Update and reproduce

From GGStarRail run `node scripts/update-data.mjs` (also `npm run data:update`).
The command updates the existing GIlore datamine cache, runs its schema/source
coverage gates, crawls HoYoWiki and
Nanoka, publishes split files directly into this checkout, and prepares WebP assets.
Any failed source request, checksum, schema, pagination, or coverage check fails the
command. No source failure becomes an empty successful catalog.

Options:

- `--cached`: regenerate from existing GIlore source snapshots without crawling or
  pulling. It still validates reference checksums and prepares assets.
- `--genshin`: also run GIlore's existing direct GenshinTools reference exporter.
  It does not modify GenshinTools application code, commit, push, or deploy.
- `--legacy-cache`: update the separately audited legacy reference/PNG fallback
  cache. Its fixed revision/count checks remain mandatory for that cache.
- `--package`: include that legacy audit, create its reference/PNG release archive and
  update its lockfile. Publish that release before pushing its lockfile. Ordinary
  updates do not replace a working lock with an unpublished release URL.

`GILORE_ROOT` selects a producer checkout; otherwise the sibling `../GIlore` is
used. Raw HoYo evidence lives in GIlore `data/raw/honkai_star_rail/hoyolab.json`;
Nanoka snapshots live under `data/raw/honkai_star_rail/nanoka/<version>/`.
The standalone crawlers are `node scripts/hoyolab.mjs` and
`node scripts/nanoka.mjs`; their default scratch is ignored `.cache/data-sources/`.
Their `--no-images` option is for source inspection, not a complete publication.

The producer command is:

```sh
uv run python -m hsr_data.website_export --evidence data/raw/honkai_star_rail/hoyolab.json --nanoka-root data/raw/honkai_star_rail/nanoka --website-root ../GGStarRail
```

It also retains split snapshots in GIlore
`data/reference/honkai_star_rail/website/<source_version>/`. Prior game versions
are not removed. `--archive-root` overrides that archive location.

## Files and reconstruction

Tracked `src/data/game/manifest.json` has transport `schema_version: "1.0.0"`,
`source_revision`, `game_version`, `members`, `reference_manifest`, and
`release_evidence`. `reference_manifest` preserves the original source metadata
and exactly the source schema's count keys, recomputed for released records;
it omits raw member `files`, and has empty `source_files`. Raw diagnostics and
corroboration are never runtime imports because they can contain hidden names.

Members are `characters`, `light_cones`, `relic_sets`, `relic_pieces`,
`achievement_categories`, `achievements`, `property_tables`, `progression`, plus
partial preview members `nanoka_characters`, `nanoka_light_cones`,
`nanoka_relic_sets`.

Each `members[name]` has `released` and `beta`, each containing `stats`, `en`,
and `zh` descriptors. A descriptor is `{path, sha256, byte_count}`; its checksum
and byte count cover the actual file bytes, including gzip compression.

- Released: `<member>_stats.json`, `<member>_en.json`, `<member>_zh.json`.
- Beta: `<member>_beta_stats.json.gz`, `<member>_beta_en.json.gz`,
  `<member>_beta_zh.json.gz`.

Stats files retain the existing MemberDocument wrapper and numeric/structural
value. Each bilingual `LocalizedText` node becomes `{"$text":"/value/..."}`.
Locale files map that JSON pointer to the original `SourceText`, including
provenance. Pointers are scoped to one member and one released/beta partition,
start at the document root, and use RFC 6901 escaping (`~0`, `~1`). Reconstruct
each partition before merging: replace a marker with
`{en: english[pointer], "zh-CN": chinese[pointer]}`.

Every `source_revision` property equal to the current raw source SHA is encoded
as `"$source_revision"`. Hydrate that token from transport manifest
`source_revision`. This replacement applies only to properties with that exact
key/value; literal display text is unaffected. A revision-only update therefore
changes the manifest while unchanged member transport hashes remain stable.
Nanoka's own version provenance remains explicit.

Beta files are deterministic gzip (`mtime=0`), compact sorted UTF-8 JSON. The
producer verifies split/rejoin equality before writing. English and Chinese are
separate transport assets, although current bilingual provider/search contracts
load both. Route-level member loading remains independent.

## Visibility and merging

Unknown status is gated. HoYoWiki page existence alone is insufficient: evidence
requires explicit `beta === false`, `status === "Online"`, an exact identity
join, a source response SHA-256, and the current normalized reference revision.
Characters additionally match HoYo Path/Combat Type filters. The two protagonist
gender IDs share one officially identified Path; March 7th forms are distinct.
Achievement evidence comes from exact visible headings in HoYoWiki's category
tables, not arbitrary mentions or category existence. Nanoka version labels and
timestamps never independently establish official release.

Full normalized records also come from the audited production datamine slice.
Non-beta wiki publication alone does not establish obtainability for new
entities absent from that slice. Those remain partial source previews behind
opt-in. This can include released collaboration characters missing from the
datamine: "source preview" does not mean "unreleased".

Released records win ID collisions. The deliberate exception is character
`enhancements`: a released base character's official page does not verify future
enhancement seasons, so released `enhancements` is empty and the complete
original character remains in beta. With opt-in only, the loader takes the beta
enhancements while preserving every other released field. Shared progression
mechanics remain available; item/path/property records are admitted through
verified entities' references. Character-specific scoring rows are partitioned
by released character ID. Category visibility follows verified achievements.

The exporter checks prior IDs before replacing any output: source disappearance
fails instead of deleting the only available released or beta record. Promotion
only removes a beta record when a complete current normalized record can replace
it. Existing source IDs and persisted account identifiers do not change.

## Partial Nanoka previews

Nanoka omits required fields from complete schema 1.2 combat records, such as
experience types, some promotion gates, rank unlock costs and effect identities.
The exporter does not fabricate them. Only IDs absent from the normalized
collection become previews. They are archive data, not build-engine inputs.

Preview value records contain `id`, `name: LocalizedText`, nullable `rarity`,
`path_id`, `combat_type_id`, `image_path`, `sections`, `stats`, `source_url`, and
`source_version`. Their released partition is empty. `image_path` is an absolute
local `/assets/ggstarrail/webp/<sha256>.webp` URL when images were crawled.

Sections contain `{id,title,description,parameters}`. Titles/descriptions are
source-localized text; description can be null. IDs are `skill:<id>`,
`rank:<rank>`, `trace:<point_id>`, `effect`, or `set:<required_pieces>`.
`parameters` contains each supplied level's numeric parameter array. Unnamed
trace headings are omitted rather than invented. Set sections use the actual
set name as title. `stats` maps the exact supplied stat keys to numeric arrays
in promotion order; no missing combat field is inferred.

Character stat keys are `attack_base`, `attack_add`, `defence_base`,
`defence_add`, `hp_base`, `hp_add`, `speed_base`, `critical_chance`,
`critical_damage`, `base_aggro`. Light Cone keys are `base_hp`, `base_hp_add`,
`base_attack`, `base_attack_add`, `base_defence`, `base_defence_add`.
Relic previews have no invented rarity or numeric progression.

## Assets and clean clones

Crawlers decode actual source image bytes and encode WebP with Sharp, preserving
alpha. `data/source-assets/manifest.json` and its content-addressed WebP files
are tracked. `prepare-web-assets.mjs` verifies these checksums, restores them into
ignored `public/assets/ggstarrail/webp/`, and merges them into the generated
runtime lookup. The existing Vite asset emitter then includes the same URLs in
production. Official images win same-ID collisions. There is no clean-build
dependency on crawler scratch or GIlore's raw cache.

A fresh clone retains the existing `npm run data:restore` then
`npm run assets:webp` workflow for the audited reference/PNG release. Split game
files and source WebPs come from Git. No new remote release is required for these
tracked outputs. The legacy cache supplies fallback art (including Paths and
properties) and regression fixtures; application numeric/text data comes solely
from the current split export. The latest updater never requires its new source
SHA to equal the legacy fallback SHA. Source image overlays validate against the
current game manifest. New source schemas or genuine GIlore coverage failures
still block; a pure datamine revision change does not hit the legacy fixed-SHA
gate. `node scripts/check-game-data.mjs` validates the current split output,
locale pointers, checksums, revision hydration and preview image assets.

Validate producer changes with
`uv run pytest tests/test_hsr_website_export.py`; crawler joins with
`node --test scripts/crawl-sources.test.mjs`; and the complete consumer with
`npm run check`.
