import type { CatalogAssetRef } from "@/domain/assets";
export interface PickerItem {
  id: string;
  name: string;
  searchText: string;
  iconPath: string;
  rarity: number | null;
  cornerAsset?: CatalogAssetRef & { alt: string };
  tags?: readonly string[];
}
export interface PickerFilter {
  id: string;
  label: string;
  options: readonly { id: string; label: string }[];
}
