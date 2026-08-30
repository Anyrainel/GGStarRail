# MVP scope

## Route skeleton

The runnable shell defines stable, language-independent routes:

- `/account-data/characters`
- `/account-data/inventory`
- `/account-data/light-cones`
- `/account-data/relics`
- `/account-data/planar-ornaments`
- `/builds/configure`
- `/builds/scoring`
- `/builds/filters`
- `/builds/triage`
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
- Build configurations reference characters, scoring profiles, preferred main
  stats, set requirements, and computed filters.
- Scoring is a deterministic weighted sum. It intentionally knows nothing
  about damage rotations or character value.
- Computed filters support typed numeric, boolean, and category predicates.
- Triage emits only `keep`, `review`, or `salvage-candidate` labels. Locked and
  equipped items can be protected, and no in-game mutation exists.

## Scaffold-only features

The pages do not yet provide editors, bulk actions, import review, or real
catalog names. GIlore and scanner code currently validates envelopes; it does
not ship production datasets or watch files. The HoYoLAB adapter has no
endpoint, request implementation, response schema, or UI.

## Non-goals

The repository must not acquire team damage optimization, Genshin-specific
formula/data engines, or energy calculators as incidental carry-over. A later
proposal to add any of these is a separate product-scope decision.
