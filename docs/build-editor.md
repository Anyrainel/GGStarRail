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

Workspace v4 adds `characterLightConeIds`, an ordered list of up to five unique
catalog Light Cone IDs per Character. These are build preferences, not equipped
account instances. UI selection and build-import review enforce matching Paths.
All slots remain accessible on narrow screens. Store v1/v2/v3, old backups, and
build bundle v1 initialize this previously absent field to an empty mapping.
Build bundle v2 carries the mapping. Account imports leave choices intact.

Duplicate creates an independent score profile. Move swaps positions only with
the adjacent build belonging to the same Character. Existing array order is
preserved during migration and export. New builds use one Cavern 4-piece and one
Planar 2-piece set; existing imported split-set builds remain editable.
