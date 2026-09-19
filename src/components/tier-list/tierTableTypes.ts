import type { ReactNode } from "react";
import type { CatalogAssetKind, CatalogAssetRef } from "@/domain/assets";

export interface TierItemData<Group extends string> extends CatalogAssetRef {
  kind: CatalogAssetKind;
  id: string;
  name: string;
  rarity: number | null;
  group: Group;
  detail?: string;
  cornerAsset?: CatalogAssetRef & { alt: string };
}

export interface TierGroupConfig<Group extends string> {
  id: Group;
  name: string;
  asset?: CatalogAssetRef;
  icon?: ReactNode;
}
