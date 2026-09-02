import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { AssetImage } from "@/components/shared/AssetImage";
import { Badge } from "@/components/ui/badge";
import type { PriorityTier } from "@/domain/tier-list/types";
import { cn } from "@/lib/utils";
import type { TierItemData } from "./tierTableTypes";

interface TierItemProps<Group extends string> {
  item: TierItemData<Group>;
  group: Group;
  tier: PriorityTier;
  onSelect: (itemId: string) => void;
}

export function TierItem<Group extends string>({
  item,
  group,
  tier,
  onSelect,
}: TierItemProps<Group>) {
  const sortable = useSortable({
    id: `priority-item:${item.id}`,
    data: { kind: "item", itemId: item.id, group, tier },
  });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.35 : 1,
    zIndex: sortable.isDragging ? 20 : undefined,
  };

  return (
    <button
      ref={sortable.setNodeRef}
      type="button"
      style={style}
      {...sortable.attributes}
      {...sortable.listeners}
      onClick={() => onSelect(item.id)}
      aria-label={item.name}
      title={item.name}
      data-priority-item-id={item.id}
      className={cn(
        "group/item relative h-14 w-14 shrink-0 touch-none overflow-hidden rounded-lg border border-border bg-background shadow-sm outline-none",
        "cursor-grab transition-transform hover:-translate-y-0.5 hover:border-primary/55 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing sm:h-16 sm:w-16"
      )}
    >
      <AssetImage
        kind={item.kind}
        id={item.id}
        sourcePath={item.sourcePath}
        alt=""
        className="h-full w-full object-contain"
      />
      {item.rarity !== null && (
        <Badge className="absolute bottom-0.5 right-0.5 border border-background/70 bg-background/85 px-1 py-0 text-[9px] tabular-nums text-foreground">
          {item.rarity}★
        </Badge>
      )}
      <span className="absolute left-0.5 top-0.5 rounded bg-background/80 p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-visible/item:opacity-100">
        <GripVertical className="h-3 w-3" aria-hidden="true" />
      </span>
    </button>
  );
}

export function TierItemPreview<Group extends string>({
  item,
}: {
  item: TierItemData<Group>;
}) {
  return (
    <div className="h-16 w-16 overflow-hidden rounded-lg border border-primary bg-background shadow-2xl">
      <AssetImage
        kind={item.kind}
        id={item.id}
        sourcePath={item.sourcePath}
        alt={item.name}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
