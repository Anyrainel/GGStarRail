# Source provenance

GGStarRail contains no bundled game data in the foundation. Future generated
content must be reproducible and reviewable before it can be treated as a
released dataset.

## Required manifest fields

Every GIlore bundle must identify:

- format `ggstarrail-data` and supported schema version;
- game identity `honkai-star-rail` and provider `gilore`;
- locale coverage in the explicit order `en`, `zh-CN`;
- upstream repository URL and exact revision;
- extractor version and generation timestamp;
- license or attribution status and optional review notes;
- each dataset's ID, version, record count, and SHA-256 checksum.

Stable entity IDs must have matching localized records in both locale bundles.
English display names must never become database keys, enum values, route
slugs, or account-record identifiers.

## Generation boundaries

- Generated files and hand-maintained overrides live separately.
- Generated output records its source revision and generator version.
- A released base bundle failing validation is a visible load error, not a
  silent fallback.
- Optional overlays may fail independently if the UI states that they are
  unavailable.
- No GenshinTools, GOOD/Enka, Genshin datamine, asset, cache, preset, or
  localized-name table is an accepted input.
- Licenses and redistribution permission must be reviewed before committing
  upstream text or image assets.

The current repository validates the manifest shape only. It does not claim to
contain or generate authoritative HSR facts.
