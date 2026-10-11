# Tier list presentation

The tier grid, centered cell icons, group tabs, tablet label column, phone tier
cards, rarity chips, customization/list controls, and detail-on-hover
interaction follow the GenshinTools components. HSR keeps its own catalogs and
persisted priority stores. Characters group by Combat Type, Light Cones by
Path, and Relic sets by kind (Cavern Relic / Planar Ornament). Legacy
DPS / Support / Other role metadata stays round-trippable in the Relic store
and documents but has no column.

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
Export tier lists through their route-owned appbar actions.

## Layout

`WideLayout` keeps the title, Customize/Manage lists controls, and grouped
filters above an independently scrolling body with no container width cap.
Body gutters match GenshinTools (16/24/32/48px). Filter groups sit in a bar
after the title, each led by a divider, so wrapped lines start at the bar's
left edge and never end on a divider. Below 768px they move to a right-side
sheet:

| Page | Groups |
| --- | --- |
| Character Priority | Caelus/Stelle + Show Paths, rarity, Owned only, Paths |
| Light Cone Priority | rarity, Owned only |
| Relic Priority | kind, Owned only |

The rarity group appears only when a list has more than one rarity. Path chips
are icon-only in the bar (named by `title` and a screen-reader label), dim the
icons of unselected Paths, and show full labels in the sheet. The kind chips
limit the grid to the chosen groups; filters never change saved rankings.
Without an imported account, Owned only keeps normal contrast, does nothing,
and names the restriction in its `title`. From 640px the Customize/Manage
lists buttons show their labels unless the measured header has no room: labels
would truncate the title or, below 1280px, wrap the filter bar onto more
lines. In English every list is icon-only at 768px and Character Priority stays
icon-only until 1024px; from 1280px all three lists keep their labels and
Character Priority's Paths group takes a second bar line where needed. At 768px
(English) the Character bar needs three lines: its groups are too wide for any
order to fit two. Show Paths still defaults to off on each visit; persisting it
would be a store schema change.

While the catalog loads or fails to load, each list keeps its `WideLayout`
title row: the active list's title and the Customize/Manage lists buttons,
disabled, with the shared loading or error state in the grid's body inset.
Below 640px the title row uses an 8px gap so every English title fits from
360px.

The full grid appears from 1000px, or from 1280px for lists with more than
seven groups (the nine Light Cone Paths). Narrower screens show one group at a
time behind sticky group tabs: 560px and up keeps a tier-label column sized to
its labels, and below 560px each tier is a card with a compact left-aligned
label over a neutral body. Group tabs never truncate; they keep full labels in
a scrolling strip, except that lists with more than seven groups (the nine
Paths) name only the active tab below 768px and show icons for the rest, named
by `title`. Every strip fits without scrolling from 360px. Tab icons load
eagerly and decode synchronously, since async-decoded icons in the sticky
strip could stay unpainted. Arrow keys, Home and End move between tabs, which
use a roving tabindex and control one tab panel. The desktop grid sits inside a
16px inset (32px more from 2000px). Headers of five to seven groups stack the
icon over the label below 1280px; denser lists always stack. Header labels are
text-base (text-lg from 1280px) for up to four groups, and text-sm (text-base
from 1280px, text-lg from 1536px) for five to seven. A renamed tier widens the
label column up to 12rem with smaller text.

Item icons are sm below 560px, lg from 1850px, and md otherwise. Light Cones
render one size smaller, except in the dense desktop grid (more than seven
groups), which is sized for them: sm below 1536px and md from there. Every item
button is as wide as its icon. An item's detail card stays closed while its
placement dialog is open.

The appbar hosts Import, with Export, Reset, and Download image in its
overflow menu; below 640px Import also moves into overflow. `PageActions`
registers page-owned callbacks with `AppShell` and unregisters them when the
route unmounts. Customize lists the title and each tier as bordered rows with
a fixed 6rem label column; on phones the title row stays horizontal and only
the tier rows stack. Manage lists shows each list as a bordered row with an
Active marker on the current one, plus Rename and Delete actions. Rename swaps
the name for an inline field: Enter or the check button saves a non-empty
name, and Escape cancels without closing the dialog.
