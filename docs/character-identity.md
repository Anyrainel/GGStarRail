# Character identity and portraits

Trailblazer has one canonical playable identity per Path/Combat Type. The
domain mapping in `src/domain/characterIdentity.ts` maps each Caelus/Stelle
source-ID pair to the odd-numbered canonical ID. Appearance is a separate
choice, stored under `ggstarrail:trailblazer-appearance:v1`.

`loadCharacters().identities` enumerates those kits once. The provider's
`values` and `byId` retain the exact source variants: their Trace IDs, skill
text, and imported account/equipment references must remain resolvable. Raw
reference exports are evidence, not a second set of rankable identities.

Character tier items use canonical IDs for drag, selection, owned filtering,
and rankings; `appearanceId` selects the portrait and hover details. Changing
appearance never changes a ranking. Existing account and build IDs are not
rewritten or discarded.

Priority store v2 and tier document v2 consolidate gender-specific ranks.
Migration keeps the higher tier; ties keep the earlier position. A rank for
only one appearance transfers unchanged. Store v0/v1 hydration, saved library
v1 hydration, and v1 JSON imports all apply the same transform. Other item
categories retain their placements. Unknown future formats are rejected.

HoYoWiki's Trailblazer portraits are two-frame GIFs. Both frames must be
extracted. The audited Harmony GIF starts with Stelle; the other four Paths
start with Caelus. `scripts/trailblazer-assets.mjs` records this order, refreshes
the tracked assets, and retains `source_frame` in asset provenance. The normal
HoYoWiki crawler uses the same frame selection. Asset preparation rejects
missing/wrong frame metadata and identical gender portraits. Regenerate with:

```sh
node scripts/trailblazer-assets.mjs
npm run assets:webp
```

ItemIcon uses square Light Cone corners, reduced Character corners, and the
existing Relic corners. Character art covers its frame and aligns at the
bottom. Light Cones use intrinsic width with one CSS pixel of vertical bleed
on each edge and no rarity background; their
source aspect ratios are wider than the 11:16 frame. This crops the tiny
source border and omits the inset ring without Chromium's object-cover
downsampling artifacts on large source images.
