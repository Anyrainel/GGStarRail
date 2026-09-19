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
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { FilterChip } from "@/components/shared/FilterChip";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { canonicalCharacterId } from "@/domain/characterIdentity";
import {
  PRIORITY_ROWS,
  RELIC_PRIORITY_GROUPS,
} from "@/domain/tier-list/constants";
import type {
  TierDocument,
  TierPresentation,
} from "@/domain/tier-list/document";
import type {
  PriorityAssignments,
  PriorityPlacement,
  PriorityTier,
  RelicGroupAssignments,
  RelicPriorityGroup,
} from "@/domain/tier-list/types";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/catalogPresentation";
import { useTierLibraryStore } from "@/stores/useTierLibraryStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { TierItemPreview } from "./TierItem";
import { TierLayout } from "./TierLayout";
import { TierToolbar } from "./TierToolbar";
import type { TierGroupConfig, TierItemData } from "./tierTableTypes";

interface TierTableProps<Group extends string> {
  extraFilters?: ReactNode;
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
  extraFilters,
  items,
  groups,
  assignments,
  groupAssignments = {},
  allowGroupChange = false,
  filterItem,
  onChange,
}: TierTableProps<Group>) {
  const { t, locale } = useI18n();
  const { data: references } = useBuildReferences();
  const account = useWorkspaceStore((state) => state.account);
  const category =
    items[0]?.kind === "light-cone"
      ? "light-cone"
      : items[0]?.kind === "relic-set"
        ? "relic-set"
        : "character";
  const [presentation, setPresentation] = useState<TierPresentation>(() => {
    const library = useTierLibraryStore.getState();
    const active = library.active[category];
    return (
      (active && library.documents[active]?.presentation) || {
        title: "",
        labels: {},
        hidden: [],
      }
    );
  });
  const [rarities, setRarities] = useState(
    () =>
      new Set(
        items.flatMap((item) => (item.rarity === null ? [] : [item.rarity]))
      )
  );
  const [paths, setPaths] = useState<Set<string>>(() => new Set());
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [showPaths, setShowPaths] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const document = useMemo<TierDocument>(
    () => ({
      kind: "ggstarrail.tier-list",
      schemaVersion: 2,
      category,
      assignments,
      groupAssignments,
      presentation,
    }),
    [category, assignments, groupAssignments, presentation]
  );
  const ownedIds = useMemo(
    () =>
      new Set(
        category === "character"
          ? account?.characters.map((item) =>
              canonicalCharacterId(item.definitionId)
            )
          : category === "light-cone"
            ? account?.lightCones.map((item) => item.definitionId)
            : account?.relics.map((item) => item.setId)
      ),
    [account, category]
  );
  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => {
          if (item.rarity !== null && !rarities.has(item.rarity)) return false;
          if (ownedOnly && account && !ownedIds.has(item.id)) return false;
          const path = references?.characters.byId.get(item.id)?.path_id;
          return (
            category !== "character" ||
            !paths.size ||
            (!!path && paths.has(path))
          );
        })
        .map((item) => {
          const pathId =
            showPaths && category === "character"
              ? references?.characters.byId.get(item.id)?.path_id
              : undefined;
          const path = pathId
            ? references?.properties.pathById.get(pathId)
            : undefined;
          return path
            ? {
                ...item,
                cornerAsset: {
                  kind: "path" as const,
                  id: path.id,
                  sourcePath: path.icon_path,
                  alt: localizedName(path.name, locale, path.id),
                },
              }
            : item;
        }),
    [
      items,
      rarities,
      ownedOnly,
      account,
      ownedIds,
      references,
      category,
      paths,
      showPaths,
      locale,
    ]
  );
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
    for (const item of visibleItems) {
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
  }, [assignments, effectiveGroup, filterItem, groups, visibleItems]);

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
      <TierToolbar
        document={document}
        itemIds={new Set(itemsById.keys())}
        onApply={(next) => {
          onChange({
            assignments: next.assignments,
            groupAssignments: next.groupAssignments,
          });
          setPresentation(next.presentation);
        }}
        onPresentationChange={setPresentation}
        tableRef={tableRef}
        filters={
          <>
            {extraFilters}
            {category === "character" && (
              <FilterChip
                active={showPaths}
                onClick={() => setShowPaths(!showPaths)}
              >
                {t("tier.controls.showPaths")}
              </FilterChip>
            )}
            <FilterChipGroup
              options={[
                ...new Set(
                  items.flatMap((item) =>
                    item.rarity === null ? [] : [item.rarity]
                  )
                ),
              ].sort((a, b) => b - a)}
              selectedValues={rarities}
              onSelectedValuesChange={setRarities}
              getKey={String}
              getLabel={(rarity) => `${rarity}★`}
              getColor={(rarity) =>
                rarity === 5
                  ? "rarity-5"
                  : rarity === 4
                    ? "rarity-4"
                    : rarity === 3
                      ? "rarity-3"
                      : undefined
              }
              emptyMeansAll={false}
            />
            <FilterChip
              active={ownedOnly && !!account}
              disabled={!account}
              onClick={() => setOwnedOnly(!ownedOnly)}
            >
              {t("tier.controls.ownedOnly")}
            </FilterChip>
            {category === "character" && references && (
              <FilterChipGroup
                options={references.properties.paths
                  .map((path) => path.id)
                  .filter((id) =>
                    items.some(
                      (item) =>
                        references.characters.byId.get(item.id)?.path_id === id
                    )
                  )}
                selectedValues={paths}
                onSelectedValuesChange={setPaths}
                getKey={(id) => id}
                getLabel={(id) =>
                  localizedName(
                    references.properties.pathById.get(id)?.name,
                    locale,
                    id
                  )
                }
                getIcon={(id) => (
                  <AssetImage
                    kind="path"
                    id={id}
                    sourcePath={
                      references.properties.pathById.get(id)?.icon_path ?? ""
                    }
                    alt=""
                    className="h-4 w-4 object-contain"
                  />
                )}
              />
            )}
          </>
        }
      >
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
          <div ref={tableRef}>
            <TierLayout
              presentation={presentation}
              groups={groups}
              itemsByCell={itemsByCell}
              groupsLabel={t("tier.priority.groups")}
              poolLabel={t("tier.priority.pool")}
              onSelect={setSelectedItemId}
            />
          </div>
          <DragOverlay>
            {activeItem ? <TierItemPreview item={activeItem} /> : null}
          </DragOverlay>
        </DndContext>
      </TierToolbar>

      <ResponsiveDialog
        open={Boolean(selectedItem)}
        onOpenChange={(open) => !open && setSelectedItemId(null)}
      >
        <ResponsiveDialogContent
          aria-describedby={undefined}
          closeLabel={t("common.close")}
          className="md:max-w-lg"
        >
          {selectedItem && selectedGroup && selectedTier && (
            <>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>
                  {t("tier.priority.editTitle", { item: selectedItem.name })}
                </ResponsiveDialogTitle>
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
              </div>
            </>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
