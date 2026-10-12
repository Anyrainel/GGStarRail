import type { PickerItem } from "@/services/catalog/pickerTypes";

/** Catalog picker items for Characters, Light Cones and Relic sets. */
export interface MemberPickerItems {
  readonly characters: readonly PickerItem[];
  readonly lightCones: readonly PickerItem[];
  /** Cavern Relic sets only. */
  readonly cavernSets: readonly PickerItem[];
  /** Planar Ornament sets only. */
  readonly planarSets: readonly PickerItem[];
}

export interface MemberItemLookup {
  readonly characters: ReadonlyMap<string, PickerItem>;
  readonly lightCones: ReadonlyMap<string, PickerItem>;
  readonly relicSets: ReadonlyMap<string, PickerItem>;
}
