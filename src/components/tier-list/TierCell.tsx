import { useDroppable } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import type { PriorityTier } from "@/domain/tier-list/types";
import { cn } from "@/lib/utils";
import { TierItem } from "./TierItem";
import type { TierItemData } from "./tierTableTypes";

interface TierCellProps<Group extends string> {
  group: Group;
  tier: PriorityTier;
  items: readonly TierItemData<Group>[];
  emptyLabel: string;
  onSelect: (itemId: string) => void;
  compact?: boolean;
}

export function TierCell<Group extends string>({
  group,
  tier,
  items,
  emptyLabel,
  onSelect,
  compact = false,
}: TierCellProps<Group>) {
  const droppable = useDroppable({
    id: `priority-cell:${group}:${tier}`,
    data: { kind: "cell", group, tier },
  });

  return (
    <div
      ref={droppable.setNodeRef}
      data-priority-tier={tier}
      data-priority-group={group}
      className={cn(
        "flex min-h-[5rem] flex-wrap content-start gap-2 border-border bg-background/45 p-2 transition-colors",
        compact ? "rounded-b-lg border border-t-0" : "border-b border-r",
        droppable.isOver && "bg-primary/10 ring-2 ring-inset ring-primary/55"
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
            onSelect={onSelect}
          />
        ))}
      </SortableContext>
      {items.length === 0 && (
        <span className="m-auto text-xs text-muted-foreground">
          {emptyLabel}
        </span>
      )}
    </div>
  );
}
