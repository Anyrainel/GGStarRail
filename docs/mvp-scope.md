# MVP scope

## Route skeleton

The runnable shell defines stable, language-independent routes:

- `/account-data/characters`
- `/account-data/inventory`
- `/account-data/light-cones`
- `/account-data/relics`
- `/account-data/planar-ornaments`
- `/account-data/triage`
- `/builds/configure`
- `/builds/scoring`
- `/builds/filters`
- `/archive/characters`
- `/archive/light-cones`
- `/archive/relic-sets`
- `/data-sources`

Navigation, document titles, empty states, accessibility labels, status cards,
and error recovery are localized in English and Simplified Chinese.

## Implemented domain behavior

- Account snapshots contain Characters, Light Cones, and Relics.
- Characters reference Path and Combat Type by stable ID and carry progression,
  Eidolon, Trace, Light Cone, and Relic references.
- Light Cones carry Path, level, ascension, Superimposition, lock, and equip
  state.
- Relics use Head, Hands, Body, Feet, Planar Sphere, and Link Rope slots.
- Relic category is derived as Cavern Relic or Planar Ornament.
- Build configurations provide the normal four-piece Cavern plus two-piece
  Planar flow, with an explicit advanced two-plus-two Cavern alternative.
  Head and Hands have fixed main stats; Body, Feet, Planar Sphere, and Link
  Rope preferences are editable. The advanced alternative is retained because
  the current [Fribbels HSR Optimizer guide](https://github.com/fribbels/hsr-optimizer/blob/main/docs/guides/en/optimizer.md)
  still supports both two-piece and four-piece Relic-set combinations; it does
  not clutter the default 4+2 workflow.
- Scoring normalizes flat and ratio stats against the generated affix-roll
  tables, applies editable per-stat weights, and reports deterministic item,
  equipped-build, grade, and threshold results. It intentionally knows
  nothing about damage rotations or Character value.
- Per-slot filters and recommended loadouts are derived from a build and its
  scoring profile, including legal aggregate two-plus-two allocation.
- Triage emits only `keep`, `review`, or `salvage-review`. Locked, equipped,
  and unknown-state pieces are protected or held for review. The optional
  GOODScanner manager file contains review instructions, not an in-game
  mutation claim.

## Local data boundary

The application imports the complete normalized GIlore reference bundle
through an explicit verified sync. Generated data is local and ignored rather
than committed. Catalog members load lazily and retain stable IDs, bilingual
values, and provenance.

Account Data owns the primary responsive import action and empty-state entry.
It accepts scanner files, public UID showcase imports, and transient Global/CN
Battle Chronicle credentials; the demo loader is a secondary development aid.
Data Sources remains help and diagnostics rather than a required workflow
step. All sources converge on the same account schema, carry prominently
displayed per-section coverage, and pass through review plus explicit account
identity resolution before merge or replacement. Battle Chronicle and UID
sources never claim to contain unequipped inventory. See
[Account imports](account-imports.md).

## Non-goals

The repository must not acquire team damage optimization, Genshin-specific
formula/data engines, or energy calculators as incidental carry-over. A later
proposal to add any of these is a separate product-scope decision.
