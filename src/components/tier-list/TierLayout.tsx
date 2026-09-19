import { useEffect, useMemo, useState } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { PRIORITY_ROWS } from "@/domain/tier-list/constants";
import type { TierPresentation } from "@/domain/tier-list/document";
import type { PriorityTier } from "@/domain/tier-list/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { combatTypeHeaderColor, tierColor } from "@/lib/gameColors";
import { cn } from "@/lib/utils";
import { TierCell } from "./TierCell";
import type { TierGroupConfig, TierItemData } from "./tierTableTypes";

interface TierLayoutProps<Group extends string> {
  presentation: TierPresentation;
  groups: readonly TierGroupConfig<Group>[];
  itemsByCell: ReadonlyMap<string, readonly TierItemData<Group>[]>;
  groupsLabel: string;
  poolLabel: string;
  onSelect: (itemId: string) => void;
}

function cellKey(group: string, tier: PriorityTier): string {
  return `${group}\0${tier}`;
}

function GroupHeader<Group extends string>({
  group,
  count,
  dense,
}: {
  group: TierGroupConfig<Group>;
  count: number;
  dense: boolean;
}) {
  return (
    <div
      style={{ backgroundColor: combatTypeHeaderColor(group.id) }}
      className={cn(
        "flex min-w-0 min-h-12 items-center justify-center gap-2 rounded-t-md border-b border-r border-gray-600 bg-secondary px-2 text-center font-bold text-gray-100",
        dense && "flex-col gap-1 py-2"
      )}
    >
      {group.asset ? (
        <AssetImage
          {...group.asset}
          alt=""
          className="h-6 w-6 shrink-0 object-contain"
        />
      ) : (
        group.icon
      )}
      <span
        className={cn(
          "min-w-0 max-w-full",
          dense ? "text-xs 2xl:text-sm" : "text-sm 2xl:text-lg"
        )}
      >
        {group.name} ({count})
      </span>
    </div>
  );
}

function TierLabel({
  tier,
  poolLabel,
  compact = false,
  label,
}: {
  tier: PriorityTier;
  poolLabel: string;
  compact?: boolean;
  label?: string;
}) {
  return (
    <div
      style={{ backgroundColor: tierColor(tier, "header") }}
      className={cn(
        "flex min-w-0 items-center justify-center border-b border-r border-gray-600 px-2 text-center font-bold text-gray-100 [overflow-wrap:anywhere]",
        compact
          ? "min-h-9 rounded-t-lg px-3 text-sm"
          : "min-h-[5rem] rounded-l-md text-xl"
      )}
    >
      {label || (tier === "Pool" ? poolLabel : tier)}
    </div>
  );
}

export function TierLayout<Group extends string>({
  presentation,
  groups,
  itemsByCell,
  groupsLabel,
  poolLabel,
  onSelect,
}: TierLayoutProps<Group>) {
  const desktop = useMediaQuery("(min-width: 1000px)");
  const tablet = useMediaQuery("(min-width: 560px)");
  const tiers = PRIORITY_ROWS.filter(
    (tier) => !presentation.hidden.includes(tier)
  );
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const defaultGroup =
    groups.find((group) => group.id === "other") ?? groups[0];

  useEffect(() => {
    if (selectedGroup && !groups.some((group) => group.id === selectedGroup)) {
      setSelectedGroup(null);
    }
  }, [groups, selectedGroup]);

  const desktopColumns = useMemo(
    () => `5rem repeat(${groups.length}, minmax(0, 1fr))`,
    [groups.length]
  );
  const mobileGroup =
    groups.find((group) => group.id === selectedGroup) ?? defaultGroup;

  if (groups.length === 0 || !mobileGroup) return null;

  if (!desktop) {
    return (
      <div>
        <div
          role="tablist"
          aria-label={groupsLabel}
          className="scrollbar-none sticky top-0 z-10 mb-4 flex h-14 max-w-full overflow-x-auto border-b bg-background/95 backdrop-blur sm:justify-center"
        >
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={group.id === mobileGroup.id}
              onClick={() => setSelectedGroup(group.id)}
              className={cn(
                "inline-flex h-14 min-w-12 shrink-0 flex-1 flex-col items-center justify-center gap-1 border-b-2 px-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-20",
                group.id === mobileGroup.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {group.asset ? (
                <AssetImage
                  {...group.asset}
                  alt=""
                  className="h-6 w-6 object-contain"
                />
              ) : (
                group.icon
              )}
              <span className="w-full truncate text-center">{group.name}</span>
            </button>
          ))}
        </div>
        <div className={cn("relative isolate", !tablet && "space-y-3")}>
          {tiers.map((tier) => (
            <section
              key={tier}
              className={cn(tablet && "grid grid-cols-[5rem_1fr]")}
            >
              <TierLabel
                tier={tier}
                label={presentation.labels[tier]}
                poolLabel={poolLabel}
                compact={!tablet}
              />
              <TierCell
                group={mobileGroup.id}
                tier={tier}
                items={itemsByCell.get(cellKey(mobileGroup.id, tier)) ?? []}
                onSelect={onSelect}
                compact={!tablet}
              />
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-auto pb-2">
      <div
        className="grid select-none"
        style={{
          gridTemplateColumns: desktopColumns,
        }}
      >
        <div />
        {groups.map((group) => (
          <GroupHeader
            dense={groups.length > 7}
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
          />,
          ...groups.map((group) => (
            <TierCell
              key={`${tier}:${group.id}`}
              group={group.id}
              tier={tier}
              items={itemsByCell.get(cellKey(group.id, tier)) ?? []}
              onSelect={onSelect}
            />
          )),
        ])}
      </div>
    </div>
  );
}
