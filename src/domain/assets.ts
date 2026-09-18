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

export interface CatalogAssetRef {
  kind: CatalogAssetKind;
  id: string;
  sourcePath?: string | null;
}

export interface CatalogAssetLookupEntry {
  kind: CatalogAssetKind;
  id: string;
  sourcePath?: string | null;
  cachePath: string | null;
}
