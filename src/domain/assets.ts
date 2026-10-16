export type CatalogAssetKind =
  | "achievement"
  | "achievement-category"
  | "achievement-reward"
  | "currency-war-equipment"
  | "currency-war-environment"
  | "currency-war-strategy"
  | "currency-war-bond"
  | "character"
  | "light-cone"
  | "relic-set"
  | "relic-piece"
  | "relic-slot"
  | "path"
  | "combat-type"
  | "property";

export type CatalogAssetVariant = "avatar" | "round" | "portrait" | "icon";

export interface CatalogAssetRef {
  kind: CatalogAssetKind;
  id: string;
  variant?: CatalogAssetVariant | null;
  sourcePath?: string | null;
}

export interface CatalogAssetLookupEntry extends CatalogAssetRef {
  cachePath: string | null;
}
