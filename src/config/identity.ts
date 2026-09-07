export const PRODUCT_ID = "ggstarrail" as const;
export const PRODUCT_NAME = "GGStarRail" as const;
export const GAME_ID = "honkai-star-rail" as const;
export const ASSET_NAMESPACE = "/assets/ggstarrail" as const;

export const STORAGE_KEYS = {
  beta: "ggstarrail:enable-beta:v1",
  locale: "ggstarrail:locale:v1",
  theme: "ggstarrail:theme:v1",
  workspace: "ggstarrail:workspace:v1",
  resourceSettings: "ggstarrail:resource-settings:v1",
  characterPriority: "ggstarrail:character-priority:v1",
  lightConePriority: "ggstarrail:light-cone-priority:v1",
  relicPriority: "ggstarrail:relic-priority:v1",
} as const;

export const BACKUP_IDENTITY = {
  product: PRODUCT_NAME,
  kind: "ggstarrail.backup",
  schemaVersion: 1,
} as const;
