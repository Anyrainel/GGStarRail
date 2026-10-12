import { ChevronDown, Settings, TriangleAlert } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CONFIGURABLE_SLOTS,
  type ConfigurableSlot,
} from "@/domain/combat/optimize/idealRelics";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import { formatChange } from "@/services/combat/presentation";
import { CompactSelect } from "../team/Controls";
import { MemberAvatar } from "../team/MemberAvatar";
import { useTeamDmgData } from "../team/TeamDmgData";
import { useSlotName, useStatName } from "./RelicCells";

export interface StatSheetView {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}

/**
 * The team's change from one member's new Relics (teammates as the run left
 * them), tinted by direction.
 */
export function DeltaChip({
  value,
  reference,
  className,
}: {
  value: number;
  reference: number;
  className?: string;
}) {
  const { locale, t } = useI18n();
  if (reference <= 0) return null;
  const positive = value >= reference;
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums md:text-xs",
        positive
          ? "bg-primary/10 text-primary"
          : "bg-destructive/10 text-destructive",
        className
      )}
      title={t("teamOptimizer.vsCurrentAlone")}
      data-delta={positive ? "up" : "down"}
    >
      {formatChange(value, reference, locale)}
    </span>
  );
}

/**
 * One member's stat sheet: header, Relics (4 + 2), view pills and views. The
 * tile spans five rows of its grid as a subgrid, so headers, Relic sections
 * and view pills line up across a row even when the Relic layouts differ. Its
 * one column may shrink below its content, so long rows truncate.
 */
export function StatSheetTile({
  slot,
  characterId,
  name,
  headerExtra,
  headerEnd,
  relics,
  notice,
  views,
}: {
  slot: number;
  characterId: string;
  name: string;
  /** Beside the name (the Ideal main-stat filter). */
  headerExtra?: ReactNode;
  /** Right end of the header (the change vs current). */
  headerEnd?: ReactNode;
  relics: ReactNode;
  notice?: ReactNode;
  views: readonly StatSheetView[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const baseId = useId();
  const active = views.find((view) => view.id === open) ?? null;
  return (
    <article
      aria-label={name}
      className="row-span-5 grid min-w-0 grid-cols-1 grid-rows-subgrid gap-y-0 overflow-hidden rounded-lg border border-border"
      data-stat-sheet={slot}
    >
      <div className="flex w-full min-w-0 items-center gap-2 border-b border-border p-2">
        <MemberAvatar characterId={characterId} decorative />
        <span className="min-w-0 truncate text-xs font-bold md:text-sm">
          {name}
        </span>
        {headerExtra}
        <span className="flex-1" />
        {headerEnd}
      </div>
      <div
        className={cn(
          "flex flex-col justify-center border-b border-border p-1 2xl:p-2",
          !notice && "row-span-2"
        )}
      >
        {relics}
      </div>
      {notice && (
        <p className="flex items-center gap-1.5 border-b border-border px-2 py-1.5 text-xs text-muted-foreground">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">{notice}</span>
        </p>
      )}
      {views.length === 0 && <div aria-hidden />}
      {views.length > 0 && (
        <div
          className={cn(
            "flex items-stretch gap-1 px-2 py-1.5",
            active && "border-b border-border"
          )}
        >
          {views.map((view) => {
            const selected = view.id === open;
            return (
              <button
                key={view.id}
                type="button"
                aria-expanded={selected}
                aria-controls={`${baseId}-${view.id}`}
                onClick={() => setOpen(selected ? null : view.id)}
                data-view-pill={view.id}
                className={cn(
                  "flex flex-1 items-center justify-center gap-0.5 rounded-full px-1 py-0.5 text-[9px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:px-1.5 md:py-1 md:text-[11px] xl:text-xs",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-accent"
                )}
              >
                {view.label}
                <ChevronDown
                  className={cn(
                    "hidden h-3 w-3 transition-transform xl:block",
                    selected && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      )}
      {active ? (
        <div id={`${baseId}-${active.id}`} className="px-2 pb-2 pt-1">
          {active.content}
        </div>
      ) : (
        <div aria-hidden />
      )}
    </article>
  );
}

/** One main stat per variable slot, or {@link ANY_MAIN_STAT}. */
export type MainStatChoice = Partial<Record<ConfigurableSlot, string>>;

/** Allows every main stat in a slot, whatever the builds choose. */
export const ANY_MAIN_STAT = "__any__";
/** The select value of an unset slot: the builds' main stats. */
const DEFAULT_MAIN_STAT = "__default__";

/**
 * Ideal-only filter: per variable slot, the builds' main stats (default),
 * any main stat, or one chosen main stat.
 */
export function MainStatFilter({
  name,
  value,
  defaults,
  onChange,
  disabled,
}: {
  name: string;
  value: MainStatChoice;
  /** The builds' main stats per slot; an empty slot allows any. */
  defaults: Readonly<Partial<Record<ConfigurableSlot, readonly string[]>>>;
  onChange: (next: MainStatChoice) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const { references } = useTeamDmgData();
  const slotName = useSlotName();
  const stat = useStatName();
  const baseId = useId();
  const active = Object.values(value).some(Boolean);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`${name} · ${t("teamOptimizer.mainStatFilter")}`}
          title={t("teamOptimizer.mainStatFilter")}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
            active && "text-primary"
          )}
          data-main-stat-filter={active ? "active" : "default"}
        >
          <Settings className="h-3 w-3 md:h-3.5 md:w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        collisionPadding={8}
        className="w-[min(90vw,340px)] space-y-2 p-3 md:w-[min(90vw,400px)]"
      >
        <div className="text-xs font-bold">{t("combat.tools.mainStats")}</div>
        {/* Body and Feet, then Planar Sphere and Link Rope. */}
        <div className="grid grid-cols-2 gap-2">
          {CONFIGURABLE_SLOTS.map((slot) => {
            const options =
              references.properties.relicSlotById.get(CATALOG_RELIC_SLOT[slot])
                ?.valid_main_properties ?? [];
            const builds = defaults[slot] ?? [];
            const labelId = `${baseId}-${slot}`;
            return (
              <div key={slot} className="flex min-w-0 flex-col gap-1">
                <span
                  id={labelId}
                  className="truncate text-center text-[10px] font-semibold text-muted-foreground md:text-xs"
                >
                  {slotName(slot)}
                </span>
                <CompactSelect
                  labelledBy={labelId}
                  value={value[slot] ?? DEFAULT_MAIN_STAT}
                  onValueChange={(next) => {
                    const updated = { ...value };
                    if (next === DEFAULT_MAIN_STAT) delete updated[slot];
                    else updated[slot] = next;
                    onChange(updated);
                  }}
                  options={[
                    {
                      value: DEFAULT_MAIN_STAT,
                      label: builds.length
                        ? builds.map((id) => stat.short(id)).join(" / ")
                        : t("teamOptimizer.anyStat"),
                    },
                    ...(builds.length
                      ? [
                          {
                            value: ANY_MAIN_STAT,
                            label: t("teamOptimizer.anyStat"),
                          },
                        ]
                      : []),
                    ...options.map((propertyId) => ({
                      value: propertyId,
                      label: stat.short(propertyId),
                    })),
                  ]}
                  className="h-7 w-full justify-between px-2 text-xs md:h-7 md:text-xs"
                />
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
