import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { getCombatTypeColor, getTierColor } from "@/components/shared/colors";
import { PRIORITY_ROWS } from "@/domain/tier-list/constants";
import type { TierPresentation } from "@/domain/tier-list/document";
import type { PriorityTier } from "@/domain/tier-list/types";

import { cn } from "@/lib/utils";
import { TierCell } from "./TierCell";
import { isDenseTierGrid, useTierLayout } from "./tierLayoutMode";
import type { TierGroupConfig, TierItemData } from "./tierTableTypes";

interface TierLayoutProps<Group extends string> {
  presentation: TierPresentation;
  groups: readonly TierGroupConfig<Group>[];
  itemsByCell: ReadonlyMap<string, readonly TierItemData<Group>[]>;
  groupsLabel: string;
  poolLabel: string;
  onSelect: (itemId: string) => void;
  /** Keeps item detail cards closed, e.g. while a dialog is open. */
  hoverDisabled?: boolean;
}

/** Hairlines between grid cells, drawn over the tier tints. */
const GRID_BORDER = "border-b border-r border-gray-600 bg-clip-padding";
const LABEL_TEXT =
  "text-center font-bold text-gray-100 [overflow-wrap:anywhere]";

function cellKey(group: string, tier: PriorityTier): string {
  return `${group}\0${tier}`;
}

function GroupIcon<Group extends string>({
  group,
  eager = false,
}: {
  group: TierGroupConfig<Group>;
  /**
   * Tab icons are always above the fold. They also decode synchronously:
   * async-decoded icons in the sticky strip could stay unpainted.
   */
  eager?: boolean;
}) {
  return group.asset ? (
    <AssetImage
      {...group.asset}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding={eager ? "sync" : "async"}
      className="h-6 w-6 shrink-0 object-contain"
    />
  ) : (
    group.icon
  );
}

/** Headers stack the icon over the label where columns are narrow. */
type HeaderStack = "always" | "belowXl" | "never";

/** Up to this many groups keep one-row headers at every width. */
const ROW_HEADER_LIMIT = 4;

function GroupHeader<Group extends string>({
  group,
  count,
  stack,
}: {
  group: TierGroupConfig<Group>;
  count: number;
  stack: HeaderStack;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 min-h-12 items-center justify-center gap-2 rounded-t-md bg-secondary px-2 text-center font-bold text-gray-100",
        GRID_BORDER,
        getCombatTypeColor(group.id, "header"),
        stack === "always" && "flex-col gap-1 py-2",
        stack === "belowXl" &&
          "flex-col gap-1 py-2 xl:flex-row xl:gap-2 xl:py-0"
      )}
    >
      <GroupIcon group={group} />
      <span
        className={cn(
          "min-w-0 max-w-full",
          stack === "always"
            ? "text-xs 2xl:text-sm"
            : stack === "belowXl"
              ? "text-sm xl:text-base 2xl:text-lg"
              : "text-base xl:text-lg"
        )}
      >
        {group.name} ({count})
      </span>
    </div>
  );
}

function TierLabel({
  tier,
  label,
  poolLabel,
  variant,
}: {
  tier: PriorityTier;
  label: string | undefined;
  poolLabel: string;
  variant: "desktop" | "tablet" | "card";
}) {
  const text = label || (tier === "Pool" ? poolLabel : tier);
  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex min-h-7 items-center justify-start rounded-t-md px-3 py-1 text-sm font-bold text-gray-100 [overflow-wrap:anywhere]",
          getTierColor(tier, "header")
        )}
      >
        {text}
      </div>
    );
  }
  const desktop = variant === "desktop";
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-center rounded-l-md p-2",
        GRID_BORDER,
        getTierColor(tier, "header"),
        desktop ? "min-h-[5rem]" : "min-h-[4rem]",
        desktop && label && "max-w-48"
      )}
    >
      <span
        className={cn(
          LABEL_TEXT,
          desktop
            ? label
              ? "text-base"
              : "text-xl"
            : label
              ? "text-sm"
              : "text-lg"
        )}
      >
        {text}
      </span>
    </div>
  );
}

/**
 * Every group at once on desktop; narrower screens show one group behind
 * sticky group tabs, with a label column from 560px and stacked cards below.
 */
export function TierLayout<Group extends string>({
  presentation,
  groups,
  itemsByCell,
  groupsLabel,
  poolLabel,
  onSelect,
  hoverDisabled = false,
}: TierLayoutProps<Group>) {
  const { mode, iconSize, dense } = useTierLayout(groups.length);
  const tiers = PRIORITY_ROWS.filter(
    (tier) => !presentation.hidden.includes(tier)
  );
  const renamed = tiers.some((tier) => presentation.labels[tier]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const tabIds = useId();

  useEffect(() => {
    if (selectedGroup && !groups.some((group) => group.id === selectedGroup)) {
      setSelectedGroup(null);
    }
  }, [groups, selectedGroup]);

  const activeGroup =
    groups.find((group) => group.id === selectedGroup) ?? groups[0];

  if (!activeGroup) return null;

  if (mode === "desktop") {
    return (
      <div className="max-w-full overflow-x-auto p-4" data-tier-layout={mode}>
        <div
          className="grid select-none min-[2000px]:px-8"
          style={{
            gridTemplateColumns: `${renamed ? "minmax(5rem, max-content)" : "5rem"} repeat(${groups.length}, minmax(0, 1fr))`,
          }}
        >
          <div />
          {groups.map((group) => (
            <GroupHeader
              stack={
                dense
                  ? "always"
                  : groups.length > ROW_HEADER_LIMIT
                    ? "belowXl"
                    : "never"
              }
              key={group.id}
              group={group}
              count={PRIORITY_ROWS.filter((tier) => tier !== "Pool").reduce(
                (sum, tier) =>
                  sum + (itemsByCell.get(cellKey(group.id, tier))?.length ?? 0),
                0
              )}
            />
          ))}
          {tiers.flatMap((tier) => [
            <TierLabel
              key={`${tier}:label`}
              tier={tier}
              label={presentation.labels[tier]}
              poolLabel={poolLabel}
              variant="desktop"
            />,
            ...groups.map((group) => (
              <TierCell
                key={`${tier}:${group.id}`}
                dense={dense}
                group={group.id}
                tier={tier}
                items={itemsByCell.get(cellKey(group.id, tier)) ?? []}
                iconSize={iconSize}
                onSelect={onSelect}
                hoverDisabled={hoverDisabled}
              />
            )),
          ])}
        </div>
      </div>
    );
  }

  const panelId = `${tabIds}-panel`;
  return (
    <div data-tier-layout={mode}>
      <GroupTabs
        groups={groups}
        activeId={activeGroup.id}
        label={groupsLabel}
        panelId={panelId}
        tabIdPrefix={tabIds}
        onSelect={setSelectedGroup}
      />
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${tabIds}-${groups.indexOf(activeGroup)}`}
      >
        {mode === "compact" ? (
          <div className="space-y-2 px-4 pb-20 pt-4">
            {tiers.map((tier) => (
              <section key={tier}>
                <TierLabel
                  tier={tier}
                  label={presentation.labels[tier]}
                  poolLabel={poolLabel}
                  variant="card"
                />
                <TierCell
                  variant="card"
                  group={activeGroup.id}
                  tier={tier}
                  items={itemsByCell.get(cellKey(activeGroup.id, tier)) ?? []}
                  iconSize={iconSize}
                  onSelect={onSelect}
                  hoverDisabled={hoverDisabled}
                />
              </section>
            ))}
          </div>
        ) : (
          <div className="grid select-none grid-cols-[fit-content(25%)_1fr] px-4 pb-20 pt-4">
            {tiers.flatMap((tier) => [
              <TierLabel
                key={`${tier}:label`}
                tier={tier}
                label={presentation.labels[tier]}
                poolLabel={poolLabel}
                variant="tablet"
              />,
              <TierCell
                key={`${tier}:${activeGroup.id}`}
                group={activeGroup.id}
                tier={tier}
                items={itemsByCell.get(cellKey(activeGroup.id, tier)) ?? []}
                iconSize={iconSize}
                onSelect={onSelect}
                hoverDisabled={hoverDisabled}
              />,
            ])}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Group tabs keep full labels and scroll when they run out of room. Dense
 * lists (the nine Paths) name only the active tab below 768px; the rest show
 * icons, named by `title`. Arrow keys, Home and End move between tabs.
 */
function GroupTabs<Group extends string>({
  groups,
  activeId,
  label,
  panelId,
  tabIdPrefix,
  onSelect,
}: {
  groups: readonly TierGroupConfig<Group>[];
  activeId: Group;
  label: string;
  panelId: string;
  /** Tab `id`s are this prefix and the group's index. */
  tabIdPrefix: string;
  onSelect: (group: Group) => void;
}) {
  const dense = isDenseTierGrid(groups.length);
  const tabRefs = useRef(new Map<Group, HTMLButtonElement>());

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = groups.findIndex((group) => group.id === activeId);
    const target =
      event.key === "ArrowRight"
        ? groups[(index + 1) % groups.length]
        : event.key === "ArrowLeft"
          ? groups[(index - 1 + groups.length) % groups.length]
          : event.key === "Home"
            ? groups[0]
            : event.key === "End"
              ? groups[groups.length - 1]
              : undefined;
    if (!target) return;
    event.preventDefault();
    onSelect(target.id);
    tabRefs.current.get(target.id)?.focus();
  }

  return (
    <div className="scrollbar-none sticky top-0 z-10 max-w-full overflow-x-auto bg-background/95 backdrop-blur">
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-14 w-max min-w-full border-b",
          dense
            ? "md:mx-auto md:min-w-0"
            : "min-[560px]:mx-auto min-[560px]:min-w-0"
        )}
      >
        {groups.map((group, index) => {
          const active = group.id === activeId;
          return (
            <button
              key={group.id}
              ref={(node) => {
                if (node) tabRefs.current.set(group.id, node);
                else tabRefs.current.delete(group.id);
              }}
              type="button"
              role="tab"
              id={`${tabIdPrefix}-${index}`}
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              title={dense ? group.name : undefined}
              onClick={() => onSelect(group.id)}
              className={cn(
                "inline-flex h-14 min-w-fit flex-1 shrink-0 flex-col items-center justify-center gap-1 border-b-2 px-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring min-[560px]:px-2",
                dense
                  ? "md:min-w-16 md:flex-none"
                  : "min-[560px]:min-w-16 min-[560px]:flex-none",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <GroupIcon group={group} eager />
              <span
                className={cn(
                  "whitespace-nowrap",
                  dense && !active && "sr-only md:not-sr-only"
                )}
              >
                {group.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
