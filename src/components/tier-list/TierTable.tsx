import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  PRIORITY_ROWS,
  RELIC_PRIORITY_GROUPS,
} from "@/domain/tier-list/constants";
import type {
  PriorityAssignments,
  PriorityPlacement,
  PriorityTier,
  RelicGroupAssignments,
  RelicPriorityGroup,
} from "@/domain/tier-list/types";
import { useI18n } from "@/i18n/I18nContext";
import { TierItemPreview } from "./TierItem";
import { TierLayout } from "./TierLayout";
import type { TierGroupConfig, TierItemData } from "./tierTableTypes";

interface TierTableProps<Group extends string> {
  items: readonly TierItemData<Group>[];
  groups: readonly TierGroupConfig<Group>[];
  assignments: PriorityAssignments;
  groupAssignments?: RelicGroupAssignments;
  allowGroupChange?: boolean;
  filterItem?: (item: TierItemData<Group>) => boolean;
  onChange: (value: {
    assignments: PriorityAssignments;
    groupAssignments: RelicGroupAssignments;
  }) => void;
}

interface DropTarget<Group extends string> {
  itemId: string | null;
  group: Group;
  tier: PriorityTier;
}

function cellKey(group: string, tier: PriorityTier): string {
  return `${group}\0${tier}`;
}

export function TierTable<Group extends string>({
  items,
  groups,
  assignments,
  groupAssignments = {},
  allowGroupChange = false,
  filterItem,
  onChange,
}: TierTableProps<Group>) {
  const { t } = useI18n();
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );
  const groupIds = useMemo(
    () => new Set(groups.map((group) => group.id)),
    [groups]
  );

  const effectiveGroup = useCallback(
    (item: TierItemData<Group>): Group => {
      const override = groupAssignments[item.id];
      return allowGroupChange && override && groupIds.has(override as Group)
        ? (override as Group)
        : item.group;
    },
    [allowGroupChange, groupAssignments, groupIds]
  );

  const itemsByCell = useMemo(() => {
    const result = new Map<string, TierItemData<Group>[]>();
    for (const group of groups) {
      for (const tier of PRIORITY_ROWS) result.set(cellKey(group.id, tier), []);
    }
    for (const item of items) {
      if (filterItem && !filterItem(item)) continue;
      const group = effectiveGroup(item);
      const tier = assignments[item.id]?.tier ?? "Pool";
      result.get(cellKey(group, tier))?.push(item);
    }
    for (const [key, cellItems] of result) {
      const tier = key.split("\0")[1] as PriorityTier;
      if (tier !== "Pool") {
        cellItems.sort(
          (left, right) =>
            (assignments[left.id]?.position ?? 0) -
            (assignments[right.id]?.position ?? 0)
        );
      }
    }
    return result;
  }, [assignments, effectiveGroup, filterItem, groups, items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function reindexCell(
    nextAssignments: PriorityAssignments,
    nextGroups: RelicGroupAssignments,
    group: Group,
    tier: Exclude<PriorityTier, "Pool">,
    orderedIds?: readonly string[]
  ) {
    const ids =
      orderedIds ??
      items
        .filter((item) => {
          const override = nextGroups[item.id];
          const itemGroup =
            allowGroupChange && override && groupIds.has(override as Group)
              ? (override as Group)
              : item.group;
          return itemGroup === group && nextAssignments[item.id]?.tier === tier;
        })
        .sort(
          (left, right) =>
            (nextAssignments[left.id]?.position ?? 0) -
            (nextAssignments[right.id]?.position ?? 0)
        )
        .map((item) => item.id);
    ids.forEach((id, position) => {
      nextAssignments[id] = { tier, position };
    });
  }

  function moveItem(itemId: string, target: DropTarget<Group>) {
    const item = itemsById.get(itemId);
    if (!item) return;
    const oldGroup = effectiveGroup(item);
    const existingPlacement: PriorityPlacement | undefined = Object.hasOwn(
      assignments,
      itemId
    )
      ? assignments[itemId]
      : undefined;
    const oldTier: PriorityTier = existingPlacement?.tier ?? "Pool";
    if (!allowGroupChange && target.group !== item.group) return;
    if (
      allowGroupChange &&
      !RELIC_PRIORITY_GROUPS.includes(target.group as RelicPriorityGroup)
    ) {
      return;
    }

    const nextAssignments = { ...assignments };
    const nextGroups = { ...groupAssignments };
    if (allowGroupChange) {
      if (target.group === item.group) delete nextGroups[itemId];
      else nextGroups[itemId] = target.group as RelicPriorityGroup;
    }
    delete nextAssignments[itemId];

    if (target.tier !== "Pool") {
      const targetIds = items
        .filter((candidate) => {
          if (candidate.id === itemId) return false;
          const override = nextGroups[candidate.id];
          const candidateGroup =
            allowGroupChange && override && groupIds.has(override as Group)
              ? (override as Group)
              : candidate.group;
          return (
            candidateGroup === target.group &&
            nextAssignments[candidate.id]?.tier === target.tier
          );
        })
        .sort(
          (left, right) =>
            (nextAssignments[left.id]?.position ?? 0) -
            (nextAssignments[right.id]?.position ?? 0)
        )
        .map((candidate) => candidate.id);
      const targetIndex = target.itemId ? targetIds.indexOf(target.itemId) : -1;
      targetIds.splice(
        targetIndex < 0 ? targetIds.length : targetIndex,
        0,
        itemId
      );
      reindexCell(
        nextAssignments,
        nextGroups,
        target.group,
        target.tier,
        targetIds
      );
    }

    if (
      oldTier !== "Pool" &&
      (oldTier !== target.tier || oldGroup !== target.group)
    ) {
      reindexCell(nextAssignments, nextGroups, oldGroup, oldTier);
    }

    onChange({ assignments: nextAssignments, groupAssignments: nextGroups });
    const tierName =
      target.tier === "Pool" ? t("tier.priority.pool") : target.tier;
    setAnnouncement(
      t("tier.priority.moved", { item: item.name, tier: tierName })
    );
  }

  function readDropTarget(event: DragEndEvent): DropTarget<Group> | null {
    const data = event.over?.data.current;
    if (!data) return null;
    const group = data.group;
    const tier = data.tier;
    if (
      typeof group !== "string" ||
      !groupIds.has(group as Group) ||
      !PRIORITY_ROWS.includes(tier as PriorityTier)
    ) {
      return null;
    }
    return {
      itemId:
        data.kind === "item" && typeof data.itemId === "string"
          ? data.itemId
          : null,
      group: group as Group,
      tier: tier as PriorityTier,
    };
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItemId(null);
    const itemId = event.active.data.current?.itemId;
    const target = readDropTarget(event);
    if (typeof itemId !== "string" || !target) return;
    const item = itemsById.get(itemId);
    if (!item) return;
    const currentTier: PriorityTier = assignments[itemId]?.tier ?? "Pool";
    if (
      target.itemId === itemId &&
      target.tier === currentTier &&
      target.group === effectiveGroup(item)
    ) {
      return;
    }
    moveItem(itemId, target);
  }

  const selectedItem = selectedItemId
    ? (itemsById.get(selectedItemId) ?? null)
    : null;
  const selectedGroup = selectedItem ? effectiveGroup(selectedItem) : null;
  const selectedTier = selectedItem
    ? (assignments[selectedItem.id]?.tier ?? "Pool")
    : null;
  const activeItem = activeItemId ? itemsById.get(activeItemId) : undefined;

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => {
          const itemId = event.active.data.current?.itemId;
          setActiveItemId(typeof itemId === "string" ? itemId : null);
        }}
        onDragCancel={() => setActiveItemId(null)}
        onDragEnd={handleDragEnd}
      >
        <TierLayout
          groups={groups}
          itemsByCell={itemsByCell}
          emptyLabel={t("tier.priority.dropHere")}
          groupsLabel={t("tier.priority.groups")}
          poolLabel={t("tier.priority.pool")}
          onSelect={setSelectedItemId}
        />
        <DragOverlay>
          {activeItem ? <TierItemPreview item={activeItem} /> : null}
        </DragOverlay>
      </DndContext>

      <ResponsiveDialog
        open={Boolean(selectedItem)}
        onOpenChange={(open) => !open && setSelectedItemId(null)}
      >
        <ResponsiveDialogContent
          closeLabel={t("common.close")}
          className="md:max-w-lg"
        >
          {selectedItem && selectedGroup && selectedTier && (
            <>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>
                  {t("tier.priority.editTitle", { item: selectedItem.name })}
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  {t("tier.priority.editDescription")}
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <div className="mt-5 space-y-5">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-semibold">
                    {t("tier.priority.chooseTier")}
                  </legend>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {PRIORITY_ROWS.map((tier) => (
                      <Button
                        key={tier}
                        type="button"
                        variant={tier === selectedTier ? "default" : "outline"}
                        aria-pressed={tier === selectedTier}
                        onClick={() =>
                          moveItem(selectedItem.id, {
                            group: selectedGroup,
                            tier,
                            itemId: null,
                          })
                        }
                      >
                        {tier === "Pool" ? t("tier.priority.pool") : tier}
                      </Button>
                    ))}
                  </div>
                </fieldset>
                {allowGroupChange && (
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-semibold">
                      {t("tier.priority.chooseRole")}
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {groups.map((group) => (
                        <Button
                          key={group.id}
                          type="button"
                          variant={
                            group.id === selectedGroup ? "default" : "outline"
                          }
                          aria-pressed={group.id === selectedGroup}
                          onClick={() =>
                            moveItem(selectedItem.id, {
                              group: group.id,
                              tier: selectedTier,
                              itemId: null,
                            })
                          }
                        >
                          {group.name}
                        </Button>
                      ))}
                    </div>
                  </fieldset>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("tier.priority.savedLocally")}
                </p>
              </div>
            </>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
