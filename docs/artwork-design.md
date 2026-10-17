# Catalog artwork audit and display proposal

Measured on 2026-10-16 after replacing Character, Light Cone, Relic and Planar
Ornament artwork with the original Nanoka gallery WebPs and three verified
HoYoWiki Avatar fallbacks. This is a proposal for
the four display modes, not a claim that every existing caller has migrated.
The source switch and independent variant selection are implemented.

## Source inventory

The selected current catalog contains 99 Character IDs, 172 Light Cone IDs,
64 sets and 774 rarity-specific Relic/Ornament piece IDs. Shared artwork is
downloaded once; multiple rarity IDs can resolve to the same original file.

| Asset | Available mappings | Source dimensions |
| --- | ---: | --- |
| Character Avatar Icon | 98 | All 160 × 188; 95 Nanoka, three HoYoWiki fallbacks |
| Character Round Icon | 99 | All 128 × 128 |
| Light Cone flat portrait | 172 | 170 at 904 × 1260; one 902 × 1258; one 902 × 1260 |
| Light Cone tilted icon | 172 | 171 at 348 × 408; one 317 × 394 |
| Relic / Ornament set | 64 | 60 at 256 × 256; four at 128 × 128 |
| Relic / Ornament piece | 774 | 610 at 256², 112 at 512², 32 at 128²; 20 non-square mappings |

The non-square piece mappings represent five unique original images, repeated
for four rarities: 256 × 249, 256 × 230, 256 × 252, 249 × 256 and 196 × 256.
Preserve their silhouettes using `contain` inside a square equipment frame.
Do not stretch or crop them to make their files square.

The unusual Light Cone tilted image is ID 21042. Its portrait is 902 × 1258;
ID 22001 has the 902 × 1260 portrait. These small native differences must not
change the dimensions of aligned or square display frames.

Nanoka's Avatar endpoints currently return 404 for 1507 (千冶·刃),
1512 (知更鸟·晴歌), 1513 (砂金·戏浪), and preview-only 1511. Their Round Icons
exist. The first three now use explicitly recorded, live-verified HoYoWiki
160 × 188 portraits. HoYoWiki's page for 1511 (Aeon ★ Aha) currently offers a
118 × 130 crop, so its native Avatar request still renders the normal missing-art
placeholder; its Nanoka Round Icon works. No Shop Icon or generated crop is
presented as a standard Avatar. Re-running acquisition retries Nanoka first.

The prior square artwork for Yukong, Hanya, Rappa and The Herta has been
replaced by the same 160 × 188 Avatar Icon format as other available Characters.
The old preview crawler selected Shop Icons (376 × 512); that artwork category
is no longer used as a Character Avatar Icon. Trailblazer gender/Path IDs each
resolve directly to their own Avatar and Round files, without GIF frame rules.

## Four display modes

Every mode shares width presets. Keep existing card widths 40, 48, 56, 64 and
80 CSS px; name small inline widths explicitly (16, 20, 24, 28) in the same
shared size configuration rather than introducing page-specific dimensions.
Image source selection and frame mode are separate typed concepts.

1. **Native** preserves the actual source aspect ratio and all pixels. Height is
   intrinsic. Default sources are Character Avatar, flat Light Cone portrait,
   and original Relic/Ornament art. The tilted Light Cone image can be shown as
   an alternate native view in the art gallery; it is not a fifth frame mode.
2. **Aligned** fixes the artwork frame at width:height **40:47**, following the
   measured Character Avatar. Characters fill it without a crop. Flat Light
   Cone art is fully contained, centered, with rarity-gradient gutters. At
   width 80 both artwork frames are exactly 80 × 94 CSS px. Typical Light Cone
   gutters are about **7.85% per side**, derived from its actual source ratio;
   do not force the square mode's 5% rule onto the aligned frame.
3. **Square** uses the same width and height for every equipment type.
   Characters use the central square crop of Avatar art. Flat Light Cone art
   is 90% of frame width, horizontally and vertically centered, with overflow
   clipped above/below and exactly 5% rarity gutters at each side. Relics and
   Ornaments use `contain`, preserving all of their original silhouettes.
4. **Round** is Character-only and uses the independent Round Icon, completely
   contained in the square avatar box. Do not generate it by clipping an Avatar
   Icon: Nanoka's Round asset has its own framing and composition.

Account views show level strips on both adjacent Character/Light Cone icons;
theory views omit both. The strip adds the same height below the artwork in
either case. Preserve identical size-dependent corner radii, chips, badge
offsets and level-strip geometry across all modes. Empty picker slots must
reserve the same frame and optional level-strip size as populated ones.

Prefer flat Light Cone portraits for aligned and square modes. At equal frame
width, the tilted art makes the actual illustration smaller and includes a
slanted white border and uneven transparent margins. Its near-matching native
ratio (29:34) is useful for an alternate game-item view, but it does not make
its composition interchangeable with the flat image.

## Recommended callers

| Surface | Mode and source |
| --- | --- |
| Account Character score-card header | Aligned Avatar + flat portrait, same size, both level strips |
| Character build/configuration header | Aligned Avatar + flat portrait, same size, neither level strip |
| Other account equipment header | Aligned pair with levels |
| Other theoretical equipment header | Aligned pair without levels |
| Team cards and member equipment grids | Square for Characters, Light Cones, Relics and Ornaments |
| Equipment picker triggers and picker contents | Square, so choosing an item does not change its shape |
| Inventory item grids and priority-tier boards | Square; native artwork is available through detail/hover |
| Archive browse lists / grids | Square for compact predictable rows |
| Archive detail and catalog hovercard | Native for complete artwork; preserve shared badge conventions |
| Damage-choice / investment equipment results | Square Light Cone and Relic icons; Round Character labels |
| Resource suggestions and matching-build labels | Round Character labels |
| Filters selecting Character identities | Square when selecting items; Round when merely labelling a row |

Implement these choices through shared primitives. Individual pages may select
mode, size, source variant and optional chrome; they must not override crop,
scale, object position, width, height or corner radius. Consolidate existing
handwritten round avatars and equipment thumbnails into these primitives.

## Quality and validation

Keep downloaded originals immutable and checksummed. This refresh stores the
original WebP bytes and does not apply the former 384px / quality-75 Light Cone
conversion. Original source files therefore remain available for visual review
and future responsive derivatives. If profiling later justifies thumbnails,
generate them from the originals with explicit density-aware sizes; never use
the tilted image as an accidental low-resolution replacement for flat art.

Run `node scripts/audit-source-artwork.mjs` to regenerate a checksum-verified
dimension report and comparison HTML under `test-results/artwork-audit/`.
The comparison keeps every example 80px wide and shows native, aligned, square,
and actual round or tilted sources side by side.

Source behavior was verified against Nanoka's live Character gallery
<https://hsr.nanoka.cc/character/1001>, Light Cone gallery
<https://hsr.nanoka.cc/lightcone/23001>, Relic gallery
<https://hsr.nanoka.cc/relic/301>, and their loaded frontend gallery components.
