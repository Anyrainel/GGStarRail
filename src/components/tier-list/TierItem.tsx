import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
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
    <CatalogHoverCard
      kind={item.kind}
      id={item.id}
      disabled={sortable.isDragging}
    >
      <button
        ref={sortable.setNodeRef}
        type="button"
        style={style}
        {...sortable.attributes}
        {...sortable.listeners}
        onClick={() => onSelect(item.id)}
        aria-label={item.name}
        data-priority-item-id={item.id}
        className={cn(
          "group/item relative w-16 shrink-0 touch-none rounded-[10px] bg-transparent shadow-sm outline-none",
          "cursor-grab transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        )}
      >
        <ItemIcon
          cornerAsset={item.cornerAsset}
          kind={item.kind}
          id={item.id}
          sourcePath={item.sourcePath}
          alt={item.name}
          rarity={item.rarity}
          size="lg"
        />
      </button>
    </CatalogHoverCard>
  );
}

export function TierItemPreview<Group extends string>({
  item,
}: {
  item: TierItemData<Group>;
}) {
  return (
    <ItemIcon
      cornerAsset={item.cornerAsset}
      kind={item.kind}
      id={item.id}
      sourcePath={item.sourcePath}
      alt={item.name}
      rarity={item.rarity}
      size="lg"
      className="rounded-[10px] ring-2 ring-primary shadow-2xl"
    />
  );
}
