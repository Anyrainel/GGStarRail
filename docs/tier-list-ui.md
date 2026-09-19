# Tier list presentation

The tier grid, centered cell icons, compact group tabs, tablet label column,
rarity chips, customization/list controls, and detail-on-hover interaction
follow the GenshinTools components. HSR keeps its own catalogs and persisted
priority stores. Characters group by Combat Type, Light Cones by Path, and
Relic sets retain their player-assigned DPS / Support / Other roles.

`src/config/gameColors.ts` is the UI palette source of truth. The Combat Type
RGB values were supplied from HoYoWiki in the design request. They deliberately
differ from the bundled `property_tables_stats.json` DamageType colors:

| Combat Type | UI / supplied HoYoWiki | Bundled DamageType |
| --- | --- | --- |
| Physical | #FFFFFF | #FFFFFF |
| Fire | #F84E36 | #F84F36 |
| Ice | #47C7FD | #47C7FD |
| Lightning (`Thunder`) | #DF53FF | #8872F1 |
| Wind | #46DE9C | #00FF9C |
| Quantum | #8780FF | #1C29BA |
| Imaginary | #FFEB61 | #F4D258 |

The bundled Chinese skill descriptions do not consistently encode these
element colors: ordinary damage text is often uncolored, while emphasized
phrases use shared `#f29e38ff` orange. Do not infer element colors from those
emphasis tags or silently replace the UI palette during catalog updates.

Column backgrounds mix each RGB channel 65% with 35% neutral grey, then reduce
brightness to 42%. S/A/B/C/D/Pool use the exact GenshinTools header and cell
hex values and the original 70% / 40% alpha respectively.

Named lists live in the new versioned `ggstarrail:tier-library:v1` store.
The existing priority stores remain the active rankings, including on first
upgrade; no existing assignments are rewritten. Named list JSON import/export
has its own strict versioned HSR document schema and validates category and IDs
before applying. The account/build backup does not include tier lists (as before).
Export tier lists with their own toolbar.
