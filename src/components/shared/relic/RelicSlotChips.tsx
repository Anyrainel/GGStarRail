import { Fragment } from "react";
import { FilterChip } from "@/components/shared/FilterChip";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import {
  CAVERN_SLOTS,
  PLANAR_SLOTS,
  RELIC_SLOTS,
  type RelicKind,
  type RelicSlotId,
} from "@/services/catalog/relicPresentation";
import { RelicKindIcon } from "./RelicKindIcon";

const GROUPS = [
  { kind: "cavern", slots: CAVERN_SLOTS },
  { kind: "planar", slots: PLANAR_SLOTS },
] as const satisfies readonly {
  kind: RelicKind;
  slots: readonly RelicSlotId[];
}[];

function normalize(next: Set<RelicSlotId>): Set<RelicSlotId> {
  return next.size === RELIC_SLOTS.length ? new Set() : next;
}

/** Toggles one slot; an empty selection means every slot. */
export function toggleRelicSlot(
  value: ReadonlySet<RelicSlotId>,
  slot: RelicSlotId
): Set<RelicSlotId> {
  const next = new Set(value);
  if (next.has(slot)) next.delete(slot);
  else next.add(slot);
  return normalize(next);
}

/** Selects a whole group, or removes it when it is already fully selected. */
export function toggleRelicKind(
  value: ReadonlySet<RelicSlotId>,
  kind: RelicKind
): Set<RelicSlotId> {
  const slots = kind === "cavern" ? CAVERN_SLOTS : PLANAR_SLOTS;
  const next = new Set(value);
  const complete = slots.every((slot) => next.has(slot));
  for (const slot of slots) {
    if (complete) next.delete(slot);
    else next.add(slot);
  }
  return normalize(next);
}

interface RelicSlotChipsProps {
  /** Selected slots; empty means all. */
  value: ReadonlySet<RelicSlotId>;
  onChange: (next: Set<RelicSlotId>) => void;
  slotLabel: (slot: RelicSlotId) => string;
  counts?: Partial<Record<RelicSlotId, number>>;
  disabled?: boolean;
  className?: string;
}

/** The 4 + 2 slot filter: Cavern Relic slots, a divider, then Planar Ornament slots. */
export function RelicSlotChips({
  value,
  onChange,
  slotLabel,
  counts,
  disabled = false,
  className,
}: RelicSlotChipsProps) {
  const { t } = useI18n();
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1", className)}
      data-relic-slot-chips
    >
      {GROUPS.map((group, index) => {
        const groupSelected =
          value.size > 0 && group.slots.every((slot) => value.has(slot));
        const kindLabel = t(
          group.kind === "cavern" ? "relic.kind.cavern" : "relic.kind.planar"
        );
        return (
          <Fragment key={group.kind}>
            {index > 0 && (
              // Phones wrap the two groups onto separate lines, where a
              // divider would dangle at the end of the first one.
              <div
                className="mx-0.5 hidden h-5 w-px shrink-0 bg-border sm:block"
                aria-hidden="true"
              />
            )}
            <div
              className="flex flex-wrap items-center gap-1"
              data-relic-kind-group={group.kind}
            >
              <FilterChip
                active={groupSelected}
                onClick={() => onChange(toggleRelicKind(value, group.kind))}
                disabled={disabled}
                title={kindLabel}
                aria-label={kindLabel}
                className="px-1.5"
              >
                <RelicKindIcon
                  kind={group.kind}
                  className="h-3.5 w-3.5"
                  decorative
                />
              </FilterChip>
              {group.slots.map((slot) => (
                <FilterChip
                  key={slot}
                  active={value.size === 0 || value.has(slot)}
                  onClick={() => onChange(toggleRelicSlot(value, slot))}
                  disabled={disabled}
                  count={counts?.[slot]}
                >
                  {slotLabel(slot)}
                </FilterChip>
              ))}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
