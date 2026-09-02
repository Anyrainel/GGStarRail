import { useEffect, useMemo, useState } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { PRIORITY_ROWS } from "@/domain/tier-list/constants";
import type { PriorityTier } from "@/domain/tier-list/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { TierCell } from "./TierCell";
import type { TierGroupConfig, TierItemData } from "./tierTableTypes";

interface TierLayoutProps<Group extends string> {
  groups: readonly TierGroupConfig<Group>[];
  itemsByCell: ReadonlyMap<string, readonly TierItemData<Group>[]>;
  emptyLabel: string;
  groupsLabel: string;
  poolLabel: string;
  onSelect: (itemId: string) => void;
}

const tierLabelClasses: Record<PriorityTier, string> = {
  S: "border-primary/60 bg-primary/25",
  A: "border-primary/45 bg-primary/15",
  B: "border-accent bg-accent/80",
  C: "border-border bg-secondary/80",
  D: "border-border bg-card/80",
  Pool: "border-border bg-muted/55",
};

function cellKey(group: string, tier: PriorityTier): string {
  return `${group}\0${tier}`;
}

function GroupHeader<Group extends string>({
  group,
}: {
  group: TierGroupConfig<Group>;
}) {
  return (
    <div className="flex min-h-12 items-center justify-center gap-2 rounded-t-lg border border-border bg-secondary/75 px-2 text-center text-sm font-semibold">
      {group.asset ? (
        <AssetImage
          {...group.asset}
          alt=""
          className="h-6 w-6 shrink-0 object-contain"
        />
      ) : (
        group.icon
      )}
      <span>{group.name}</span>
    </div>
  );
}

function TierLabel({
  tier,
  poolLabel,
  compact = false,
}: {
  tier: PriorityTier;
  poolLabel: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center border font-semibold",
        tierLabelClasses[tier],
        compact
          ? "min-h-9 rounded-t-lg px-3 text-sm"
          : "min-h-[5rem] rounded-l-lg border-b-0 text-lg last:border-b"
      )}
    >
      {tier === "Pool" ? poolLabel : tier}
    </div>
  );
}

export function TierLayout<Group extends string>({
  groups,
  itemsByCell,
  emptyLabel,
  groupsLabel,
  poolLabel,
  onSelect,
}: TierLayoutProps<Group>) {
  const desktop = useMediaQuery("(min-width: 1280px)");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const defaultGroup = useMemo(
    () =>
      groups.reduce<TierGroupConfig<Group> | undefined>((best, candidate) => {
        if (!best) return candidate;
        const candidateCount = PRIORITY_ROWS.reduce(
          (count, tier) =>
            count + (itemsByCell.get(cellKey(candidate.id, tier))?.length ?? 0),
          0
        );
        const bestCount = PRIORITY_ROWS.reduce(
          (count, tier) =>
            count + (itemsByCell.get(cellKey(best.id, tier))?.length ?? 0),
          0
        );
        return candidateCount > bestCount ? candidate : best;
      }, undefined),
    [groups, itemsByCell]
  );

  useEffect(() => {
    if (selectedGroup && !groups.some((group) => group.id === selectedGroup)) {
      setSelectedGroup(null);
    }
  }, [groups, selectedGroup]);

  const desktopColumns = useMemo(
    () => `6rem repeat(${groups.length}, minmax(9rem, 1fr))`,
    [groups.length]
  );
  const desktopWidth = `${6 + groups.length * 9}rem`;
  const mobileGroup =
    groups.find((group) => group.id === selectedGroup) ?? defaultGroup;

  if (groups.length === 0 || !mobileGroup) return null;

  if (!desktop) {
    return (
      <div>
        <div
          role="tablist"
          aria-label={groupsLabel}
          className="scrollbar-none mb-3 flex max-w-full gap-2 overflow-x-auto pb-1"
        >
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={group.id === mobileGroup.id}
              onClick={() => setSelectedGroup(group.id)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                group.id === mobileGroup.id
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-background/65 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {group.asset ? (
                <AssetImage
                  {...group.asset}
                  alt=""
                  className="h-5 w-5 object-contain"
                />
              ) : (
                group.icon
              )}
              {group.name}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {PRIORITY_ROWS.map((tier) => (
            <section key={tier}>
              <TierLabel tier={tier} poolLabel={poolLabel} compact />
              <TierCell
                group={mobileGroup.id}
                tier={tier}
                items={itemsByCell.get(cellKey(mobileGroup.id, tier)) ?? []}
                emptyLabel={emptyLabel}
                onSelect={onSelect}
                compact
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
          minWidth: desktopWidth,
        }}
      >
        <div />
        {groups.map((group) => (
          <GroupHeader key={group.id} group={group} />
        ))}
        {PRIORITY_ROWS.flatMap((tier) => [
          <TierLabel key={`${tier}:label`} tier={tier} poolLabel={poolLabel} />,
          ...groups.map((group) => (
            <TierCell
              key={`${tier}:${group.id}`}
              group={group.id}
              tier={tier}
              items={itemsByCell.get(cellKey(group.id, tier)) ?? []}
              emptyLabel={emptyLabel}
              onSelect={onSelect}
            />
          )),
        ])}
      </div>
    </div>
  );
}
