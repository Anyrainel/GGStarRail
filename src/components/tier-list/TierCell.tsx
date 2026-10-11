import { useDroppable } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { getTierColor } from "@/components/shared/colors";
import type { ItemIconSize } from "@/components/shared/ItemIcon";
import type { PriorityTier } from "@/domain/tier-list/types";
import { cn } from "@/lib/utils";
import { TierItem } from "./TierItem";
import type { TierItemData } from "./tierTableTypes";

interface TierCellProps<Group extends string> {
  group: Group;
  tier: PriorityTier;
  items: readonly TierItemData<Group>[];
  iconSize: ItemIconSize;
  onSelect: (itemId: string) => void;
  /** grid: a tier-tinted cell beside a label column; card: a phone card body. */
  variant?: "grid" | "card";
  dense?: boolean;
  hoverDisabled?: boolean;
}

export function TierCell<Group extends string>({
  group,
  tier,
  items,
  iconSize,
  onSelect,
  variant = "grid",
  dense = false,
  hoverDisabled = false,
}: TierCellProps<Group>) {
  const droppable = useDroppable({
    id: `priority-cell:${group}:${tier}`,
    data: { kind: "cell", group, tier },
  });
  const card = variant === "card";

  return (
    <div
      ref={droppable.setNodeRef}
      data-priority-tier={tier}
      data-priority-group={group}
      className={cn(
        "flex min-w-0 flex-wrap gap-2 p-2 transition-colors",
        card
          ? "min-h-[4rem] justify-start rounded-b-md border border-t-0 border-border bg-card/50"
          : "min-h-[5rem] content-start items-end justify-center border-b border-r border-gray-600 bg-clip-padding",
        dense && "px-1",
        !card && getTierColor(tier, "bg"),
        droppable.isOver && "ring-2 ring-inset ring-primary/55",
        droppable.isOver && card && "bg-primary/10"
      )}
    >
      <SortableContext
        items={items.map((item) => `priority-item:${item.id}`)}
        strategy={rectSortingStrategy}
      >
        {items.map((item) => (
          <TierItem
            key={item.id}
            item={item}
            group={group}
            tier={tier}
            size={iconSize}
            dense={dense}
            hoverDisabled={hoverDisabled}
            onSelect={onSelect}
          />
        ))}
      </SortableContext>
    </div>
  );
}
