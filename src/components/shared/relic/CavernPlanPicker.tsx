import { useState } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import type { ItemIconSize } from "@/components/shared/ItemIcon";
import {
  ItemPicker,
  ItemPickerEmptyTile,
  type PickerFilter,
  type PickerItem,
} from "@/components/shared/ItemPicker";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import { CavernPlanIcon, PlanarSetIcon } from "./SetPlanIcon";

type PlanMode = "four" | "split";
type Draft = [string | null, string | null];

/** Normalizes a picked pair: the same set twice is a 4-piece plan. */
export function cavernPlanFromPair(first: string, second: string): string[] {
  return first === second ? [first] : [first, second];
}

interface CavernPlanPickerProps {
  /** One set ID for a 4-piece plan, two for 2+2, none when unset. */
  value: readonly string[];
  /** Cavern Relic sets only. */
  items: readonly PickerItem[];
  onChange: (next: string[]) => void;
  onClear?: () => void;
  label: string;
  triggerSize?: ItemIconSize;
  disabled?: boolean;
  filters?: readonly PickerFilter[];
  /** Trigger tooltip, such as where the plan came from. */
  title?: string;
}

/** Picks a Cavern plan: one 4-piece set, or two sets for 2+2. */
export function CavernPlanPicker({
  value,
  items,
  onChange,
  onClear,
  label,
  triggerSize = "md",
  disabled = false,
  filters,
  title,
}: CavernPlanPickerProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<PlanMode>("four");
  const [draft, setDraft] = useState<Draft>([null, null]);
  const [target, setTarget] = useState<0 | 1>(0);
  const byId = new Map(items.map((item) => [item.id, item]));
  const sets = value
    .map((id) => byId.get(id))
    .filter((item): item is PickerItem => item !== undefined);

  function reset() {
    const [first = null, second = null] = value;
    const split = second !== null && second !== first;
    setMode(split ? "split" : "four");
    setDraft([first, split ? second : null]);
    setTarget(0);
  }

  function changeMode(next: PlanMode) {
    setMode(next);
    if (next === "split") {
      const first = draft[0] ?? value[0] ?? null;
      setDraft([first, null]);
      setTarget(first === null ? 0 : 1);
    }
  }

  function pick(id: string) {
    if (mode === "four") {
      onChange([id]);
      return;
    }
    const next: Draft = [...draft];
    next[target] = id;
    if (next[0] !== null && next[1] !== null) {
      onChange(cavernPlanFromPair(next[0], next[1]));
      setDraft(next);
      return;
    }
    setDraft(next);
    setTarget(target === 0 ? 1 : 0);
  }

  const completesPair =
    mode === "split" && draft[target === 0 ? 1 : 0] !== null;
  const planLabel =
    sets.length === 0
      ? label
      : sets.length === 1
        ? `${label}: ${t("relic.plan.fourPiece", { set: sets[0]!.name })}`
        : `${label}: ${t("relic.plan.split", {
            first: sets[0]!.name,
            second: sets[1]!.name,
          })}`;
  const highlighted =
    mode === "four"
      ? value.slice(0, 1)
      : draft.filter((id): id is string => id !== null);

  const header = (
    <div className="space-y-2">
      <SegmentedTabs
        size="sm"
        fullWidth
        label={t("relic.mode.label")}
        value={mode}
        onValueChange={changeMode}
        items={[
          { value: "four", label: t("relic.mode.four") },
          { value: "split", label: t("relic.mode.split") },
        ]}
      />
      {mode === "split" && (
        <div className="grid grid-cols-2 gap-2">
          {([0, 1] as const).map((index) => {
            const item = draft[index] ? byId.get(draft[index]) : undefined;
            const active = target === index;
            return (
              <button
                key={index}
                type="button"
                aria-pressed={active}
                title={item?.name}
                onClick={() => setTarget(index)}
                className={cn(
                  "flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary/40 bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
                data-plan-target={index}
              >
                <span className="shrink-0 font-semibold">
                  {t(
                    index === 0 ? "relic.target.first" : "relic.target.second"
                  )}
                </span>
                {item ? (
                  <>
                    <AssetImage
                      kind="relic-set"
                      id={item.id}
                      sourcePath={item.iconPath}
                      alt=""
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 object-contain"
                    />
                    <span className="min-w-0 truncate">{item.name}</span>
                  </>
                ) : (
                  <span
                    className="h-5 w-5 shrink-0 rounded border border-dashed border-border"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <ItemPicker
      kind="relic-set"
      items={items}
      filters={filters}
      value={value[0] ?? null}
      selectedIds={highlighted}
      label={label}
      triggerLabel={planLabel}
      triggerTitle={title}
      onChange={pick}
      onClear={onClear}
      onOpenChange={(open) => {
        if (open) reset();
      }}
      closeOnSelect={mode === "four" || completesPair}
      contentHeader={header}
      disabled={disabled}
      triggerSize={triggerSize}
      renderTrigger={() =>
        sets.length ? (
          <CavernPlanIcon sets={sets} size={triggerSize} decorative />
        ) : (
          <ItemPickerEmptyTile size={triggerSize} />
        )
      }
    />
  );
}

interface PlanarSetPickerProps {
  value: string | null;
  /** Planar Ornament sets only. */
  items: readonly PickerItem[];
  onChange: (id: string) => void;
  onClear?: () => void;
  label: string;
  triggerSize?: ItemIconSize;
  disabled?: boolean;
  filters?: readonly PickerFilter[];
  /** Trigger tooltip, such as where the plan came from. */
  title?: string;
}

/** Picks one Planar Ornament set; the trigger carries its 2-piece badge. */
export function PlanarSetPicker({
  value,
  items,
  onChange,
  onClear,
  label,
  triggerSize = "md",
  disabled = false,
  filters,
  title,
}: PlanarSetPickerProps) {
  const { t } = useI18n();
  const selected = items.find((item) => item.id === value) ?? null;
  return (
    <ItemPicker
      kind="relic-set"
      items={items}
      filters={filters}
      value={value}
      label={label}
      triggerLabel={
        selected
          ? `${label}: ${t("relic.plan.planar", { set: selected.name })}`
          : label
      }
      triggerTitle={title}
      onChange={onChange}
      onClear={onClear}
      disabled={disabled}
      triggerSize={triggerSize}
      renderTrigger={() =>
        selected ? (
          <PlanarSetIcon set={selected} size={triggerSize} decorative />
        ) : (
          <ItemPickerEmptyTile size={triggerSize} />
        )
      }
    />
  );
}
