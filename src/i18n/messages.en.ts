export const messagesEn = {
  "app.name": "GGStarRail",
  "app.tagline": "A local-first Star Rail build workspace",
  "app.foundation": "Application foundation",
  "app.locale": "Language",
  "app.locale.english": "English",
  "app.locale.chinese": "简体中文",
  "nav.overview": "Overview",
  "nav.account": "Account",
  "nav.characters": "Characters",
  "nav.inventory": "Inventory",
  "nav.equipment": "Equipment",
  "nav.lightCones": "Light Cones",
  "nav.relics": "Relics",
  "nav.planarOrnaments": "Planar Ornaments",
  "nav.planning": "Build Lab",
  "nav.builds": "Builds",
  "nav.scoring": "Scoring",
  "nav.filters": "Computed Filters",
  "nav.triage": "Triage",
  "nav.archive": "Archive",
  "nav.archiveCharacters": "Character Archive",
  "nav.archiveLightCones": "Light Cone Archive",
  "nav.archiveRelicSets": "Relic Set Archive",
  "nav.imports": "Data Sources",
  "route.home.title": "Foundation dashboard",
  "route.home.description":
    "The product shell, domain contracts, and safety boundaries are ready for HSR data.",
  "route.characters.title": "Account characters",
  "route.characters.description":
    "Owned characters, progression, Eidolons, Traces, and equipped item references.",
  "route.inventory.title": "Account inventory",
  "route.inventory.description":
    "A read-only summary of imported Light Cones, Relics, and Planar Ornaments.",
  "route.lightCones.title": "Light Cones",
  "route.lightCones.description":
    "Owned Light Cones with Path, level, Superimposition, lock, and equip state.",
  "route.relics.title": "Relics",
  "route.relics.description":
    "Cavern Relics across Head, Hands, Body, and Feet slots.",
  "route.planar.title": "Planar Ornaments",
  "route.planar.description":
    "Planar Spheres and Link Ropes are modeled as distinct HSR equipment slots.",
  "route.builds.title": "Build configuration",
  "route.builds.description":
    "Character targets, set requirements, main-stat preferences, and scoring references.",
  "route.scoring.title": "Relic scoring",
  "route.scoring.description":
    "User-owned stat weights feed a deterministic, damage-agnostic score.",
  "route.filters.title": "Computed filters",
  "route.filters.description":
    "Compose typed predicates over rarity, level, score, lock, equip state, and category.",
  "route.triage.title": "Relic triage",
  "route.triage.description":
    "Classify candidates for keep, review, or salvage review without mutating game data.",
  "route.archiveCharacters.title": "Character archive",
  "route.archiveCharacters.description":
    "Future GIlore-backed character definitions and localized reference text.",
  "route.archiveLightCones.title": "Light Cone archive",
  "route.archiveLightCones.description":
    "Future GIlore-backed Light Cone definitions, Paths, and effects.",
  "route.archiveRelicSets.title": "Relic set archive",
  "route.archiveRelicSets.description":
    "Future Cavern Relic and Planar Ornament set definitions and bonuses.",
  "route.imports.title": "Data sources",
  "route.imports.description":
    "Explicit boundaries for generated bundles, scanner exports, and account imports.",
  "route.notFound.title": "Page not found",
  "route.notFound.description":
    "This route is not part of the GGStarRail foundation.",
  "home.ready.title": "Ready now",
  "home.ready.body":
    "React 19, typed bilingual UI, local persistence, safe backups, domain services, tests, and a Worker health shell.",
  "home.scaffolded.title": "Scaffolded next",
  "home.scaffolded.body":
    "Real game bundles, file import controls, archive records, account-provider transport, and production Worker bindings.",
  "home.excluded.title": "Outside scope",
  "home.excluded.body":
    "Team damage optimization, the Genshin damage engine, and energy calculators are intentionally absent.",
  "home.snapshot.title": "Local workspace",
  "home.snapshot.empty": "No account snapshot has been imported.",
  "home.snapshot.source": "Source: {source}",
  "home.snapshot.counts":
    "{characters} characters · {lightCones} Light Cones · {relics} equipment pieces",
  "status.implemented": "Implemented",
  "status.scaffolded": "Scaffolded",
  "status.excluded": "Excluded",
  "status.noLiveData": "No live data configured",
  "common.open": "Open",
  "common.refresh": "Refresh",
  "common.backHome": "Back to overview",
  "common.copyDetails": "Copy technical details",
  "common.copied": "Copied",
  "common.count": "{count} records",
  "common.none": "None",
  "common.notConfigured": "Not configured",
  "field.level": "Level {value}",
  "field.eidolon": "Eidolon {value}",
  "field.superimposition": "Superimposition {value}",
  "field.path": "Path ID: {value}",
  "field.target": "Character ID: {value}",
  "field.locked": "Locked",
  "field.equipped": "Equipped",
  "empty.characters": "Import an account snapshot to list owned characters.",
  "empty.inventory": "Inventory totals will appear after a validated import.",
  "empty.lightCones": "No Light Cones are present in the local workspace.",
  "empty.relics": "No Cavern Relics are present in the local workspace.",
  "empty.planar": "No Planar Ornaments are present in the local workspace.",
  "empty.builds": "No custom build configurations have been created.",
  "empty.archive": "No provenanced game-data bundle has been loaded.",
  "scoring.engine.title": "Neutral scoring service",
  "scoring.engine.body":
    "The engine combines normalized stat values and user weights. It makes no damage or character-value claims.",
  "filters.engine.title": "Typed filter evaluator",
  "filters.engine.body":
    "All/any filters are implemented over stable HSR inventory fields and computed score.",
  "triage.engine.title": "Advisory triage only",
  "triage.engine.body":
    "Locked and equipped pieces are protected. Results are labels only; this app cannot salvage items in-game.",
  "archive.provenance.title": "Provenance required",
  "archive.provenance.body":
    "Every dataset must declare upstream source, revision, generation time, locale coverage, license note, and checksum.",
  "imports.gilore.title": "GIlore bundle",
  "imports.gilore.body":
    "Manifest validation is implemented; no Genshin bundle, cache, import, or generated asset is accepted.",
  "imports.scanner.title": "Scanner export",
  "imports.scanner.body":
    "A versioned GGStarRail scanner envelope is defined and rejects credential-shaped fields.",
  "imports.hoyolab.title": "HoYoLAB account import",
  "imports.hoyolab.body":
    "Only the ephemeral credential boundary exists. Network transport and UI are intentionally not connected.",
  "imports.security.title": "Authentication-cookie safety",
  "imports.security.body":
    "Cookie material must remain in memory for one request, then be cleared. It is never persisted, backed up, or logged.",
  "imports.boundary.ready": "Contract ready",
  "imports.boundary.future": "Adapter pending",
  "error.title": "GGStarRail could not render this page",
  "error.hint":
    "Refresh the page. If the problem continues, copy the redacted details for diagnosis.",
  "error.redacted": "Sensitive-looking values are redacted from diagnostics.",
  "terms.path.destruction": "Destruction",
  "terms.path.hunt": "The Hunt",
  "terms.path.erudition": "Erudition",
  "terms.path.harmony": "Harmony",
  "terms.path.nihility": "Nihility",
  "terms.path.preservation": "Preservation",
  "terms.path.abundance": "Abundance",
  "terms.path.remembrance": "Remembrance",
  "terms.path.elation": "Elation",
} as const;

export type MessageKey = keyof typeof messagesEn;
