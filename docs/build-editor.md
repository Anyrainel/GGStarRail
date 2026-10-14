# Character build editor

The independent HSR `ItemPicker` owns the Character, Light Cone, and Relic-set
selection surface. Callers supply catalog presentation models and restrictions;
the picker owns search, filters, selection, clear, and desktop/mobile layout.
`CharacterInfo` renders rarity, Combat Type, Path, and affiliation chips.

Affiliation IDs are a small presentation lookup from `AvatarAtlas.CampID`,
with variant membership resolved using `MultiplePathAvatarConfig.BaseAvatarID`,
at TurnBasedGameData revision `8cdb905dc2f8e6fffa9be4eb07af3e34435d6091`.
The English/Chinese labels are from that revision's `AvatarCamp.Name` text.
This uses the base in-game archive affiliation, without applying quest-dependent
spoiler changes from `AtlasAvatarChangeInfo`. Missing entries remain absent.
Run `scripts/sync-character-affiliations.py` against the independent HSR source
checkout to prepare a reviewable lookup update; it does not modify the normalized
reference bundle or use GenshinTools data.

The workspace stores `characterLightConeIds`, an ordered list of up to five
unique catalog Light Cone IDs per Character. These are build preferences, not
equipped account instances. UI selection and build-import review enforce matching
Paths. All slots remain accessible on narrow screens. Account imports leave choices intact.

Duplicate creates an independent score profile. Move swaps positions only with
the adjacent build belonging to the same Character and category.

Workspace and build bundles separate Cavern and Planar builds into independent
cards. Cavern cards configure a 4-piece or 2+2 combination, Body/Feet main stats,
and a score profile for the four Cavern slots. Planar cards configure a 2-piece
set, Sphere/Rope main stats, and a score profile for the two Planar slots. The
filter page selects one card from each category for the same Character, allowing
every cross-combination without saving duplicated 4+2 builds. Unconfigured
categories remain unconfigured and produce review decisions in triage.

The card contract is provisional during development. Earlier experimental
formats are unsupported: incompatible local workspaces start empty, and invalid
backup/build imports are rejected. Released workspace v1–v3 and build-export v1
formats remain supported through versioned migration; experimental paired-build
formats are unsupported. HoyoData generates native recommendations directly in
the independent card format.

HoyoData's full `hoyodata ggstarrail` export writes generated presets to
`src/config/presets/builds/in-game.json`. This uses the build bundle contract with optional
`metadata: { name: { en, "zh-CN" }, author }`; author is `In-Game`.
Generated card/profile names are absent. The name input stays empty until the user names a card. Labels outside the editor
may derive from Character/set IDs in the current UI language. Clearing a name
removes the saved user text. Cards may be disabled without deleting them; disabled
cards do not generate filters or participate in triage or team recommendations.
Roles are optional multi-select metadata; minimum Eidolon defaults to E0.
Workspace v5 and build-export v3 preserve these fields, including subscription
baselines; older imports retain enabled, unassigned, E0 behavior. Ordinary user
exports may omit metadata. Conversion
reports remain producer-side. The preset tests validate these JSON files against
the importer and available game catalogs on every check.

Selecting the in-game preset subscribes to the entire `in-game` file. Workspace
v4 and build-export bundle v2 preserve the preset ID, previous baseline, and
deleted-card tombstones. Startup reconciles the latest bundled file: untouched
cards and profiles update, while locally edited entries, custom cards, deletions,
Light Cone choices, and user ordering remain. Stopping a subscription retains
the resolved workspace. Local file import restores its saved subscription when
present; old workspace v1–v3 and build-export v1 files import as local data.
HoyoData's generated v1 file remains accepted by the importer. Failed preset
loads retain the last resolved workspace and offer a retry.
