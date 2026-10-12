import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  Package,
  TriangleAlert,
} from "lucide-react";
import { Fragment, useId, useState } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { RelicKindIcon } from "@/components/shared/relic/RelicKindIcon";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import { localizedName } from "@/services/catalog/presentation";
import { MemberAvatar } from "../team/MemberAvatar";
import { TeamCharacterGrid } from "../team/TeamCharacterGrid";
import { useTeamDmgData } from "../team/TeamDmgData";
import { useSlotName, useStatName } from "./RelicCells";
import type { SwapGuide, SwapRow, SwapStatus } from "./swapGuide";

function StatusBadge({ status }: { status: SwapStatus }) {
  const { t } = useI18n();
  const { lookup } = useTeamDmgData();
  const { icon: Icon, label } =
    status.kind === "equipped"
      ? { icon: Check, label: t("teamOptimizer.swap.equipped") }
      : status.kind === "swap"
        ? {
            icon: ArrowRightLeft,
            label: t("teamOptimizer.swap.from", {
              name:
                lookup.characters.get(status.fromCharacterId)?.name ??
                status.fromCharacterId,
            }),
          }
        : { icon: Package, label: t("teamOptimizer.swap.inventory") };
  return (
    <span
      className={cn(
        "flex min-w-0 max-w-full items-center gap-0.5 whitespace-nowrap text-[10px] font-medium leading-none md:text-[11px] lg:text-xs",
        status.kind === "equipped" ? "text-muted-foreground" : "text-primary"
      )}
      title={label}
      data-swap-status={status.kind}
    >
      <Icon className="h-2.5 w-2.5 shrink-0 lg:h-3 lg:w-3" aria-label={label} />
      <span
        className="hidden min-w-0 truncate [@container(min-width:16rem)]:inline"
        aria-hidden
      >
        {label}
      </span>
    </span>
  );
}

/** Another member's best loadout claims the same Relic. */
function ConflictBadge() {
  const { t } = useI18n();
  const label = t("teamOptimizer.swap.conflict");
  return (
    <span
      className="flex shrink-0 items-center gap-0.5 rounded bg-destructive/10 px-1 text-[10px] font-semibold leading-4 text-destructive"
      title={label}
      data-swap-conflict
    >
      <TriangleAlert className="h-2.5 w-2.5 shrink-0" aria-label={label} />
      <span className="hidden [@container(min-width:22rem)]:inline" aria-hidden>
        {label}
      </span>
    </span>
  );
}

function SlotRow({ row }: { row: SwapRow }) {
  const { locale } = useI18n();
  const { references } = useTeamDmgData();
  const slotName = useSlotName();
  const stat = useStatName();
  const relic = row.relic;
  const set = relic ? references.relicSets.byId.get(relic.setId) : undefined;
  const quiet = row.status?.kind === "equipped" && !row.conflict;
  const setName = relic ? localizedName(set?.name, locale, relic.setId) : null;
  return (
    <li
      className={cn(
        "flex gap-2 px-1 py-1 md:gap-3 md:px-2 2xl:gap-4 2xl:px-4 2xl:py-2",
        quiet && "text-muted-foreground"
      )}
      data-swap-slot={row.slot}
    >
      <div className="flex w-[45%] min-w-0 shrink-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1">
          {relic && (
            <AssetImage
              kind="relic-set"
              id={relic.setId}
              sourcePath={set?.icon_path}
              alt=""
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-sm object-contain md:h-5 md:w-5 lg:h-6 lg:w-6"
            />
          )}
          <span
            className="min-w-0 truncate text-[10px] font-semibold md:text-xs"
            title={setName ?? undefined}
          >
            {setName ?? "—"}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 md:gap-x-1.5">
          <span className="shrink-0 whitespace-nowrap text-[10px] md:text-[11px] lg:text-xs">
            {slotName(row.slot)}
          </span>
          {row.conflict && <ConflictBadge />}
          {row.status && <StatusBadge status={row.status} />}
        </div>
        {relic && (
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 text-[10px] md:text-xs lg:text-sm">
            <span
              className="min-w-0 truncate font-semibold"
              title={stat.full(relic.mainStat.statId)}
            >
              {stat.short(relic.mainStat.statId)}
            </span>
            <span className="ml-auto shrink-0 font-mono font-semibold tabular-nums">
              {stat.value(relic.mainStat.statId, relic.mainStat.value)}
            </span>
          </div>
        )}
      </div>
      <ul className="flex min-w-0 flex-1 flex-col justify-center">
        {relic?.substats.map((substat) => (
          <li
            key={substat.statId}
            className="flex min-w-0 items-center gap-1 text-[10px] leading-snug md:text-xs lg:text-sm"
          >
            <span
              className="min-w-0 truncate"
              title={stat.full(substat.statId)}
            >
              {stat.short(substat.statId)}
            </span>
            <span className="ml-auto shrink-0 font-mono tabular-nums">
              {stat.value(substat.statId, substat.value)}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * Where each recommended Relic comes from, per member, grouped Cavern Relics
 * (4) then Planar Ornaments (2).
 */
export function SwapGuidePanel({ guide }: { guide: SwapGuide }) {
  const { t } = useI18n();
  const { lookup } = useTeamDmgData();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <section
      className="overflow-hidden rounded-lg border border-border"
      aria-label={t("teamOptimizer.swap.title")}
      data-swap-guide
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-2 py-2 outline-none transition-colors hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-4 md:py-3"
      >
        <span className="flex items-center gap-1.5 text-xs font-bold md:gap-2 md:text-sm">
          {t("teamOptimizer.swap.title")}
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-normal text-muted-foreground md:px-2 md:text-xs">
            {t("teamOptimizer.swap.changes", { count: guide.changes })}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div id={bodyId} className="border-t border-border">
          <TeamCharacterGrid className="p-1 md:p-2">
            {guide.columns.map((column) => {
              const name =
                lookup.characters.get(column.characterId)?.name ??
                column.characterId;
              return (
                <article
                  key={column.teamSlot}
                  aria-label={name}
                  className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border [container-type:inline-size]"
                  data-swap-column={column.teamSlot}
                >
                  <div className="flex min-w-0 items-center gap-2 border-b border-border px-2 py-1 md:py-2">
                    <MemberAvatar characterId={column.characterId} decorative />
                    <span className="min-w-0 truncate text-xs font-bold md:text-sm">
                      {name}
                    </span>
                  </div>
                  <ul className="flex flex-col divide-y divide-border">
                    {column.rows.map((row) => (
                      <Fragment key={row.slot}>
                        {row.slot === "planarSphere" && (
                          <li
                            className="flex items-center gap-1.5 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground md:text-xs"
                            data-swap-group="planar"
                          >
                            <RelicKindIcon
                              kind="planar"
                              className="h-3 w-3"
                              decorative
                            />
                            {t("relic.kind.planar")}
                          </li>
                        )}
                        <SlotRow row={row} />
                      </Fragment>
                    ))}
                  </ul>
                </article>
              );
            })}
          </TeamCharacterGrid>
        </div>
      )}
    </section>
  );
}
