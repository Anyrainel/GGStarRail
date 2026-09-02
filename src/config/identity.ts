export const PRODUCT_ID = "ggstarrail" as const;
export const PRODUCT_NAME = "GGStarRail" as const;
export const GAME_ID = "honkai-star-rail" as const;
export const ASSET_NAMESPACE = "/assets/ggstarrail" as const;

export const STORAGE_KEYS = {
  locale: "ggstarrail:locale:v1",
  theme: "ggstarrail:theme:v1",
  workspace: "ggstarrail:workspace:v1",
} as const;

export const BACKUP_IDENTITY = {
  product: PRODUCT_NAME,
  kind: "ggstarrail.backup",
  schemaVersion: 1,
} as const;
