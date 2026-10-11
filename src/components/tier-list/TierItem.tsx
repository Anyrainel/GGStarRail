import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { ItemIcon, type ItemIconSize } from "@/components/shared/ItemIcon";
import type { PriorityTier } from "@/domain/tier-list/types";
import { cn } from "@/lib/utils";
import { TIER_ITEM_WIDTH, tierItemSize } from "./tierLayoutMode";
import type { TierItemData } from "./tierTableTypes";

interface TierItemProps<Group extends string> {
  item: TierItemData<Group>;
  group: Group;
  tier: PriorityTier;
  /** The list's icon size; Light Cones render one step smaller. */
  size: ItemIconSize;
  /** A dense desktop grid, whose size already suits Light Cones. */
  dense?: boolean;
  hoverDisabled?: boolean;
  onSelect: (itemId: string) => void;
}

function itemRadius(kind: TierItemData<string>["kind"]) {
  return kind === "character"
    ? "rounded-[3px]"
    : kind !== "light-cone" && "rounded-[10px]";
}

export function TierItem<Group extends string>({
  item,
  group,
  tier,
  size,
  dense = false,
  hoverDisabled = false,
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
  const iconSize = tierItemSize(size, item.kind, dense);

  return (
    <CatalogHoverCard
      kind={item.kind}
      id={item.appearanceId ?? item.id}
      disabled={sortable.isDragging || hoverDisabled}
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
        data-priority-item-size={iconSize}
        className={cn(
          "group/item relative shrink-0 touch-none bg-transparent shadow-sm outline-none",
          TIER_ITEM_WIDTH[iconSize],
          itemRadius(item.kind),
          "cursor-grab transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        )}
      >
        <ItemIcon
          cornerAsset={item.cornerAsset}
          kind={item.kind}
          id={item.appearanceId ?? item.id}
          sourcePath={item.sourcePath}
          alt={item.name}
          rarity={item.rarity}
          size={iconSize}
        />
      </button>
    </CatalogHoverCard>
  );
}

export function TierItemPreview<Group extends string>({
  item,
  size,
  dense = false,
}: {
  item: TierItemData<Group>;
  size: ItemIconSize;
  dense?: boolean;
}) {
  return (
    <ItemIcon
      cornerAsset={item.cornerAsset}
      kind={item.kind}
      id={item.appearanceId ?? item.id}
      sourcePath={item.sourcePath}
      alt={item.name}
      rarity={item.rarity}
      size={tierItemSize(size, item.kind, dense)}
      className={cn("ring-2 ring-primary shadow-2xl", itemRadius(item.kind))}
    />
  );
}
