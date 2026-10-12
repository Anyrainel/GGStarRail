import type { ReactNode } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { getRarityColor } from "@/components/shared/colors";
import { cn } from "@/lib/utils";
import type { PickerItem } from "@/services/catalog/pickerTypes";
import type { PlanSets } from "@/services/combat/teamPreview";

/** Ranking rows use 20px art, 28px from `lg`. */
const ROW_ICON = "h-5 w-5 lg:h-7 lg:w-7";

function RowTile({
  rarity,
  children,
  className,
  setPlan,
}: {
  /** Undefined draws an empty dashed slot. */
  rarity?: number | null;
  children?: ReactNode;
  className?: string;
  setPlan?: string;
}) {
  const empty = rarity === undefined;
  return (
    <span
      aria-hidden="true"
      data-set-plan={setPlan}
      className={cn(
        "relative block shrink-0 select-none overflow-hidden rounded-[4px] lg:rounded-md",
        ROW_ICON,
        empty
          ? "border border-dashed border-border"
          : getRarityColor(rarity ?? null, "gradient"),
        className
      )}
    >
      {children}
    </span>
  );
}

/** A square Light Cone thumbnail cropped from the top of the card art. */
export function RowLightConeIcon({ item }: { item: PickerItem | undefined }) {
  if (!item) return <RowTile />;
  return (
    <RowTile rarity={item.rarity}>
      <AssetImage
        kind="light-cone"
        id={item.id}
        sourcePath={item.iconPath}
        alt=""
        draggable={false}
        className="absolute -left-[6%] -top-[4%] h-[112%] w-[112%] max-w-none object-cover object-top"
      />
    </RowTile>
  );
}

function RowSetArt({
  item,
  className,
}: {
  item: PickerItem;
  className?: string;
}) {
  return (
    <AssetImage
      kind="relic-set"
      id={item.id}
      sourcePath={item.iconPath}
      alt=""
      draggable={false}
      className={cn("object-contain drop-shadow", className)}
    />
  );
}

/**
 * A set plan at row size: the Cavern plan (one set for 4-piece, two diagonal
 * halves for 2+2) beside the Planar Ornament set.
 */
export function RowSetPlanIcons({
  sets,
  lookup,
}: {
  sets: PlanSets;
  lookup: ReadonlyMap<string, PickerItem>;
}) {
  const [first, second] = sets.cavern.map((id) => lookup.get(id));
  const planar = sets.planar ? lookup.get(sets.planar) : undefined;
  return (
    <span className="flex shrink-0 items-center gap-0.5" data-set-plan-icons>
      {first && second ? (
        <RowTile
          rarity={Math.max(first.rarity ?? 0, second.rarity ?? 0) || null}
          setPlan="split"
        >
          <RowSetArt
            item={first}
            className="absolute left-[-6%] top-[-6%] z-10 h-[78%] w-[78%]"
          />
          <RowSetArt
            item={second}
            className="absolute bottom-[-6%] right-[-6%] z-20 h-[78%] w-[78%]"
          />
        </RowTile>
      ) : first ? (
        <RowTile rarity={first.rarity} setPlan="four">
          <RowSetArt item={first} className="h-full w-full" />
        </RowTile>
      ) : (
        <RowTile setPlan="empty" />
      )}
      {planar ? (
        <RowTile rarity={planar.rarity} setPlan="planar">
          <RowSetArt item={planar} className="h-full w-full" />
        </RowTile>
      ) : (
        <RowTile setPlan="empty" />
      )}
    </span>
  );
}
