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

Workspace and build bundle v1 separate Cavern and Planar builds into independent
cards. Cavern cards configure a 4-piece or 2+2 combination, Body/Feet main stats,
and a score profile for the four Cavern slots. Planar cards configure a 2-piece
set, Sphere/Rope main stats, and a score profile for the two Planar slots. The
filter page selects one card from each category for the same Character, allowing
every cross-combination without saving duplicated 4+2 builds. Unconfigured
categories remain unconfigured and produce review decisions in triage.

The current v1 contract is provisional during development. Earlier experimental
formats are unsupported: incompatible local workspaces start empty, and invalid
backup/build imports are rejected. There are no historical workspace or paired
build migrations. HoyoData generates native recommendations directly in this format.

HoyoData's full `hoyodata ggstarrail` export writes generated presets to
`src/presets/builds/in-game.json`. This uses the build bundle contract with optional
`metadata: { name: { en, "zh-CN" }, author }`; author is `In-Game`.
Generated card/profile names are absent. Card names derive from Character/set IDs
in the current UI language; editing a name saves literal user text. Ordinary user
exports may omit metadata. Conversion
reports remain producer-side. The preset tests validate these JSON files against
the importer and available game catalogs on every check.
