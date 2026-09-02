import { CircleHelp, LockKeyhole, Trash2, TriangleAlert } from "lucide-react";
import { AssetImage } from "@/components/shared/AssetImage";
import type { Relic } from "@/domain/account/schemas";
import type { RelicScore, ScoreGrade } from "@/domain/build/scoring";
import { useI18n } from "@/i18n/I18nContext";
import type { Locale } from "@/i18n/locales";
import type { BuildReferences } from "@/lib/buildReferences";
import {
  formatAccountStatValue,
  localizedName,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
import { cn } from "@/lib/utils";

interface RelicStatDisplayProps {
  relic: Relic;
  score?: RelicScore;
  references: BuildReferences;
  locale: Locale;
  slotName: string;
  compact?: boolean;
}

const EMPTY_SUBSTAT_ROWS = ["empty-1", "empty-2", "empty-3", "empty-4"];

function gradeClass(grade: ScoreGrade | null): string {
  switch (grade) {
    case "S":
      return "bg-amber-400/20 text-amber-200";
    case "A":
      return "bg-violet-400/20 text-violet-200";
    case "B":
      return "bg-sky-400/20 text-sky-200";
    case "C":
      return "bg-emerald-400/20 text-emerald-200";
    case "D":
      return "bg-slate-400/20 text-slate-200";
    default:
      return "bg-amber-500/15 text-amber-200";
  }
}

/** GGArtifact-style stat column adapted to one of HSR's six Relic slots. */
export function RelicStatDisplay({
  relic,
  score,
  references,
  locale,
  slotName,
  compact = false,
}: RelicStatDisplayProps) {
  const { t } = useI18n();
  const piece = references.relicPieces.byId.get(relic.definitionId);
  const pieceName = localizedName(piece?.name, locale, relic.definitionId);
  const mainStatName = localizedPropertyName(
    relic.mainStat.statId,
    references.properties,
    locale
  );
  const emptyRows = Math.max(0, 4 - relic.substats.length);
  const offTargetMain = score?.grade === null;
  const scorePercent = score ? Math.max(0, Math.min(100, score.total)) : 0;

  return (
    <article
      data-relic-slot={relic.slot}
      aria-label={t("characterLoadout.relicSlotLabel", { slot: slotName })}
      title={`${slotName} · ${pieceName}`}
      className={cn(
        "relative flex h-full min-w-0 flex-col overflow-hidden transition-colors hover:bg-white/5",
        compact ? "p-1" : "p-2"
      )}
    >
      <div
        className={cn(
          "relative z-10 mb-2 flex min-w-0 items-center justify-between gap-1",
          compact ? "text-[10px]" : "text-sm"
        )}
        data-main-stat-row
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-bold",
            offTargetMain ? "text-amber-100/70" : "text-amber-100"
          )}
          title={mainStatName}
        >
          {mainStatName}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {relic.locked === true && (
            <LockKeyhole
              className={cn(
                "text-red-300",
                compact ? "h-2.5 w-2.5" : "h-3 w-3"
              )}
              aria-label={t("field.locked")}
            />
          )}
          {relic.locked === null && (
            <CircleHelp
              className={cn(
                "text-slate-300",
                compact ? "h-2.5 w-2.5" : "h-3 w-3"
              )}
              aria-label={t("field.lockUnknown")}
            />
          )}
          {relic.discarded === true && (
            <Trash2
              className={cn(
                "text-orange-300",
                compact ? "h-2.5 w-2.5" : "h-3 w-3"
              )}
              aria-label={t("characterLoadout.discardMarked")}
            />
          )}
          <span
            className={cn(
              "rounded bg-black/40 font-mono text-amber-200",
              compact ? "px-0.5 text-[9px]" : "px-1 text-xs"
            )}
            data-relic-level={relic.level}
          >
            +{relic.level}
          </span>
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <AssetImage
          kind="relic-piece"
          id={piece?.id ?? relic.definitionId}
          sourcePath={piece?.icon_path ?? ""}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={cn(
            "pointer-events-none absolute inset-0 m-auto select-none object-contain brightness-[0.3] blur-[0.5px]",
            compact ? "h-14 w-14" : "h-20 w-20"
          )}
        />
        <div className="relative z-10 space-y-0.5" data-relic-substats>
          {relic.substats.map((stat) => {
            const contribution = score?.contributions[stat.statId];
            const weighted =
              score === undefined || (contribution?.weight ?? 0) > 0;
            const property = references.properties.propertyById.get(
              stat.statId
            );
            return (
              <div
                key={stat.statId}
                className={cn(
                  "flex min-w-0 items-center justify-between gap-0.5",
                  compact ? "text-[9px] leading-3" : "text-xs leading-4",
                  weighted ? "text-foreground" : "text-muted-foreground"
                )}
                data-relic-substat={stat.statId}
              >
                <span className="min-w-0 flex-1 truncate">
                  {localizedPropertyName(
                    stat.statId,
                    references.properties,
                    locale
                  )}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatAccountStatValue(stat.value, property, locale)}
                </span>
              </div>
            );
          })}
          {EMPTY_SUBSTAT_ROWS.slice(0, emptyRows).map((rowKey) => (
            <div
              key={rowKey}
              aria-hidden="true"
              className={compact ? "h-3" : "h-4"}
            />
          ))}
        </div>
      </div>

      {score && (
        <div
          className={cn(
            "relative z-10 mt-1 border-t border-border/60 pt-1",
            compact ? "text-[9px]" : "text-xs"
          )}
          data-relic-score={relic.key}
        >
          <div className="flex items-center justify-between gap-1 font-mono tabular-nums">
            {offTargetMain ? (
              <span
                className={cn(
                  "flex items-center gap-0.5 rounded px-1 font-bold",
                  gradeClass(score.grade)
                )}
                role="img"
                aria-label={t("scoring.offTargetMain")}
                title={t("scoring.offTargetMain")}
              >
                <TriangleAlert
                  className={compact ? "h-2.5 w-2.5" : "h-3 w-3"}
                  aria-hidden="true"
                />
                <span aria-hidden="true">—</span>
              </span>
            ) : (
              <span
                className={cn(
                  "rounded px-1 font-bold",
                  gradeClass(score.grade)
                )}
              >
                {score.grade}
              </span>
            )}
            <span className="font-semibold text-amber-100">
              {score.total.toFixed(1)}
            </span>
          </div>
          <div
            className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-label={t("characterLoadout.relicSlotLabel", {
              slot: slotName,
            })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={scorePercent}
            aria-valuetext={
              offTargetMain
                ? `${score.total.toFixed(1)}. ${t("scoring.offTargetMain")}`
                : score.total.toFixed(1)
            }
            title={offTargetMain ? t("scoring.offTargetMain") : undefined}
          >
            <div
              className={cn(
                "h-full rounded-full",
                offTargetMain
                  ? "bg-amber-500/70"
                  : "bg-gradient-to-r from-sky-400 via-violet-400 to-amber-300"
              )}
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>
      )}
    </article>
  );
}
