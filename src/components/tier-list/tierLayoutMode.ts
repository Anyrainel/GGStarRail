import type { ItemIconSize } from "@/components/shared/ItemIcon";
import type { CatalogAssetKind } from "@/domain/assets";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/** compact: stacked tier cards; tablet: a label column; desktop: every group. */
export type TierLayoutMode = "compact" | "tablet" | "desktop";

/** Lists with more groups than this (the nine Light Cone Paths) are dense. */
const DENSE_GROUP_LIMIT = 7;

export function isDenseTierGrid(groupCount: number): boolean {
  return groupCount > DENSE_GROUP_LIMIT;
}

/** Item button widths that match each ItemIcon size. */
export const TIER_ITEM_WIDTH: Readonly<Record<ItemIconSize, string>> = {
  xs: "w-10",
  sm: "w-12",
  md: "w-14",
  lg: "w-16",
  xl: "w-20",
};

const SMALLER: Readonly<Record<ItemIconSize, ItemIconSize>> = {
  xl: "lg",
  lg: "md",
  md: "sm",
  sm: "xs",
  xs: "xs",
};

/**
 * Light Cone cards are taller than they are wide, so they sit one size down.
 * A dense desktop grid is already sized for them and keeps its size.
 */
export function tierItemSize(
  base: ItemIconSize,
  kind: CatalogAssetKind,
  dense = false
): ItemIconSize {
  return kind === "light-cone" && !dense ? SMALLER[base] : base;
}

/**
 * The full grid from 1000px (1280px for dense lists), a label column from
 * 560px, stacked cards below. Icons are sm on phones, lg from 1850px, and md
 * otherwise; a dense desktop grid is sm below 1536px and md from there.
 */
export function useTierLayout(groupCount: number): {
  mode: TierLayoutMode;
  iconSize: ItemIconSize;
  /** The full grid of a dense list, whose iconSize needs no kind step. */
  dense: boolean;
} {
  const denseList = isDenseTierGrid(groupCount);
  const desktop = useMediaQuery("(min-width: 1000px)");
  const desktopDense = useMediaQuery("(min-width: 1280px)");
  const tablet = useMediaQuery("(min-width: 560px)");
  const roomy = useMediaQuery("(min-width: 1536px)");
  const wide = useMediaQuery("(min-width: 1850px)");
  const mode: TierLayoutMode = (denseList ? desktopDense : desktop)
    ? "desktop"
    : tablet
      ? "tablet"
      : "compact";
  const dense = denseList && mode === "desktop";
  const iconSize: ItemIconSize = dense
    ? roomy
      ? "md"
      : "sm"
    : mode === "compact"
      ? "sm"
      : wide
        ? "lg"
        : "md";
  return { mode, iconSize, dense };
}
