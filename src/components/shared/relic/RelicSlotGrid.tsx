import type { ReactNode } from "react";
import { type ItemIconSize, itemIconWidth } from "@/components/shared/ItemIcon";
import { useElementWidth } from "@/hooks/useElementWidth";
import {
  CAVERN_SLOTS,
  PLANAR_SLOTS,
  type RelicSlotId,
} from "@/lib/relicPresentation";
import { cn } from "@/lib/utils";

export type RelicSlotGridLayout = "auto" | "row" | "stacked";

interface RelicSlotGridProps {
  renderSlot: (slot: RelicSlotId, iconSize: ItemIconSize) => ReactNode;
  /** An optional set row aligned to the Cavern (4) and Planar (2) groups. */
  header?: { cavern?: ReactNode; planar?: ReactNode };
  layout?: RelicSlotGridLayout;
  maxIconSize?: ItemIconSize;
  className?: string;
}

const STEP_SIZES = [
  "xl",
  "lg",
  "md",
  "sm",
  "xs",
] as const satisfies readonly ItemIconSize[];
/** The widest grid gap (lg:gap-1.5) and the divider cell (w-px + mx-0.5). */
const GAP = 6;
const DIVIDER = 5;

function rowWidth(size: ItemIconSize): number {
  return 6 * itemIconWidth(size) + 6 * GAP + DIVIDER;
}

function stackedWidth(size: ItemIconSize): number {
  return 4 * itemIconWidth(size) + 3 * GAP;
}

function sizesFrom(max: ItemIconSize): readonly ItemIconSize[] {
  return STEP_SIZES.slice(STEP_SIZES.indexOf(max));
}

/**
 * Chooses the arrangement and icon size for a measured width: one 4 + 2 row,
 * stepping icons down to fit, then four Cavern slots over two Planar slots.
 */
export function resolveRelicSlotGrid(
  width: number | null,
  layout: RelicSlotGridLayout,
  maxIconSize: ItemIconSize
): { layout: "row" | "stacked"; iconSize: ItemIconSize } {
  const sizes = sizesFrom(maxIconSize);
  const smallest = sizes[sizes.length - 1] ?? maxIconSize;
  const available = width !== null && width > 0 ? width : null;
  const fitting = (needed: (size: ItemIconSize) => number) =>
    available === null
      ? maxIconSize
      : sizes.find((size) => needed(size) <= available);
  if (layout === "row" || (layout === "auto" && available === null)) {
    return { layout: "row", iconSize: fitting(rowWidth) ?? smallest };
  }
  if (layout === "auto") {
    const fit = fitting(rowWidth);
    if (fit) return { layout: "row", iconSize: fit };
  }
  return { layout: "stacked", iconSize: fitting(stackedWidth) ?? smallest };
}

const ROW_TEMPLATE =
  "grid-cols-[repeat(4,minmax(0,1fr))_auto_repeat(2,minmax(0,1fr))]";

/** The six Relic slots as Cavern Relics (4) and Planar Ornaments (2). */
export function RelicSlotGrid({
  renderSlot,
  header,
  layout = "auto",
  maxIconSize = "md",
  className,
}: RelicSlotGridProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const resolved = resolveRelicSlotGrid(width, layout, maxIconSize);
  const hasHeader = Boolean(header?.cavern || header?.planar);

  const slotCell = (slot: RelicSlotId, kind: "cavern" | "planar") => (
    <div
      key={slot}
      className="flex min-w-0 justify-center"
      data-relic-slot={slot}
      data-relic-kind={kind}
    >
      {renderSlot(slot, resolved.iconSize)}
    </div>
  );

  if (resolved.layout === "stacked") {
    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-0 grid-cols-4 items-center gap-0.5 md:gap-1 lg:gap-1.5",
          className
        )}
        data-relic-slot-grid="stacked"
        data-icon-size={resolved.iconSize}
      >
        {header?.cavern && (
          <div className="col-span-4 min-w-0" data-relic-group-header="cavern">
            {header.cavern}
          </div>
        )}
        {CAVERN_SLOTS.map((slot) => slotCell(slot, "cavern"))}
        <div className="col-span-4 h-px bg-border" aria-hidden="true" />
        {PLANAR_SLOTS.map((slot) => slotCell(slot, "planar"))}
        <div
          className="col-span-2 min-w-0 overflow-hidden"
          data-relic-group-header="planar"
        >
          {header?.planar}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        "grid min-w-0 items-center gap-0.5 md:gap-1 lg:gap-1.5",
        ROW_TEMPLATE,
        className
      )}
      data-relic-slot-grid="row"
      data-icon-size={resolved.iconSize}
    >
      {hasHeader && (
        <>
          <div className="col-span-4 min-w-0" data-relic-group-header="cavern">
            {header?.cavern}
          </div>
          <div aria-hidden="true" />
          <div className="col-span-2 min-w-0" data-relic-group-header="planar">
            {header?.planar}
          </div>
        </>
      )}
      {CAVERN_SLOTS.map((slot) => slotCell(slot, "cavern"))}
      <div
        className="mx-0.5 w-px self-stretch bg-border"
        aria-hidden="true"
        data-relic-divider
      />
      {PLANAR_SLOTS.map((slot) => slotCell(slot, "planar"))}
    </div>
  );
}

/** An empty slot tile: a dashed square with the slot name. */
export function RelicSlotPlaceholder({
  label,
  size = "md",
  className,
}: {
  label: string;
  size?: ItemIconSize;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex aspect-square shrink-0 items-center justify-center rounded-md border border-dashed border-border p-0.5 text-center text-[10px] leading-tight text-muted-foreground",
        className
      )}
      style={{ width: itemIconWidth(size) }}
      data-relic-slot-placeholder
    >
      <span className="line-clamp-2 min-w-0 break-words">{label}</span>
    </div>
  );
}
