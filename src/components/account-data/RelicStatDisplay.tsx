import { CircleHelp, LockKeyhole, Trash2, TriangleAlert } from "lucide-react";
import { AssetImage } from "@/components/shared/AssetImage";
import type { Relic } from "@/domain/account/schemas";
import type { RelicScore, ScoreGrade } from "@/domain/build/scoring";
import { useI18n } from "@/i18n/I18nContext";
import type { Locale } from "@/i18n/locales";
import { cn } from "@/lib/utils";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import {
  formatAccountStatValue,
  localizedName,
  localizedPropertyName,
} from "@/services/catalog/presentation";
import { shortStatKey } from "@/services/catalog/relicPresentation";

interface RelicStatDisplayProps {
  relic: Relic;
  score?: RelicScore;
  references: BuildReferences;
  locale: Locale;
  slotName: string;
  compact?: boolean;
  className?: string;
}

const ELEMENT_DAMAGE_SUFFIX = "AddedRatio";
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

/** One Relic slot of a loadout: main stat and level, substats, and score. */
export function RelicStatDisplay({
  relic,
  score,
  references,
  locale,
  slotName,
  compact = false,
  className,
}: RelicStatDisplayProps) {
  const { t } = useI18n();
  const piece = references.relicPieces.byId.get(relic.definitionId);
  const pieceName = localizedName(piece?.name, locale, relic.definitionId);
  const statLabel = (statId: string) => {
    const key = shortStatKey(statId);
    return key
      ? t(key)
      : localizedPropertyName(statId, references.properties, locale);
  };
  const mainStatName = localizedPropertyName(
    relic.mainStat.statId,
    references.properties,
    locale
  );
  // Elemental DMG Boost main stats show their Combat Type icon.
  const mainElement = relic.mainStat.statId.endsWith(ELEMENT_DAMAGE_SUFFIX)
    ? references.properties.combatTypeById.get(
        relic.mainStat.statId.slice(0, -ELEMENT_DAMAGE_SUFFIX.length)
      )
    : undefined;
  const emptyRows = Math.max(0, 4 - relic.substats.length);
  const offTargetMain = score?.grade === null;
  const scorePercent = score ? Math.max(0, Math.min(100, score.total)) : 0;
  const lineText = compact ? "text-[10px] md:text-xs" : "text-sm";
  const markerClass = compact ? "h-2.5 w-2.5" : "h-3 w-3";
  const markers = [
    relic.locked === true && (
      <LockKeyhole
        key="locked"
        className={cn("text-red-300", markerClass)}
        role="img"
        aria-label={t("field.locked")}
      />
    ),
    relic.locked === null && (
      <CircleHelp
        key="lock-unknown"
        className={cn("text-slate-300", markerClass)}
        role="img"
        aria-label={t("field.lockUnknown")}
      />
    ),
    relic.discarded === true && (
      <Trash2
        key="discard"
        className={cn("text-orange-300", markerClass)}
        role="img"
        aria-label={t("characterLoadout.discardMarked")}
      />
    ),
  ].filter(Boolean);

  return (
    <article
      data-relic-column={relic.slot}
      aria-label={t("characterLoadout.relicSlotLabel", { slot: slotName })}
      title={`${slotName} · ${pieceName}`}
      className={cn(
        "group relative flex h-full w-full min-w-0 flex-col overflow-hidden transition-colors hover:bg-white/5",
        compact ? "p-1" : "p-2",
        className
      )}
    >
      <div
        className="mb-2 flex min-w-0 items-center justify-between gap-1"
        data-main-stat-row
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-bold",
            offTargetMain ? "text-amber-100/70" : "text-amber-100",
            compact ? "text-[10px] md:text-xs" : "text-sm xl:text-base"
          )}
          title={mainStatName}
        >
          {mainElement ? (
            <span className="flex min-w-0 items-center gap-1">
              <AssetImage
                kind="combat-type"
                id={mainElement.id}
                sourcePath={mainElement.icon_path}
                alt={localizedName(mainElement.name, locale, mainElement.id)}
                className={cn(
                  "shrink-0 object-contain",
                  compact ? "h-3 w-3 md:h-3.5 md:w-3.5" : "h-4 w-4"
                )}
              />
              <span className="min-w-0 truncate">
                {t("characterLoadout.elementDamage")}
              </span>
            </span>
          ) : (
            statLabel(relic.mainStat.statId)
          )}
        </span>
        <span
          className={cn(
            "shrink-0 whitespace-nowrap rounded bg-black/40 font-mono text-amber-200",
            compact ? "px-0.5 text-[10px]" : "px-1 text-xs"
          )}
          data-relic-level={relic.level}
        >
          +{relic.level}
        </span>
      </div>

      <div className="relative space-y-0.5 overflow-hidden" data-relic-substats>
        <AssetImage
          kind="relic-piece"
          id={piece?.id ?? relic.definitionId}
          sourcePath={piece?.icon_path ?? ""}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={cn(
            "pointer-events-none absolute inset-0 m-auto select-none object-contain brightness-[0.3] blur-[1px]",
            compact ? "h-16 w-16" : "h-20 w-20"
          )}
        />
        {relic.substats.map((stat) => {
          const contribution = score?.contributions[stat.statId];
          const weighted =
            score === undefined || (contribution?.weight ?? 0) > 0;
          const property = references.properties.propertyById.get(stat.statId);
          return (
            <div
              key={stat.statId}
              className={cn(
                "relative z-10 flex min-w-0 items-center justify-between gap-0.5",
                lineText,
                weighted ? "text-foreground" : "text-muted-foreground"
              )}
              data-relic-substat={stat.statId}
              title={localizedPropertyName(
                stat.statId,
                references.properties,
                locale
              )}
            >
              <span className="min-w-0 flex-1 truncate">
                {statLabel(stat.statId)}
              </span>
              <span className="shrink-0 whitespace-nowrap tabular-nums">
                {formatAccountStatValue(stat.value, property, locale)}
              </span>
            </div>
          );
        })}
        {EMPTY_SUBSTAT_ROWS.slice(0, emptyRows).map((rowKey) => (
          <div key={rowKey} aria-hidden="true" className={lineText}>
            &nbsp;
          </div>
        ))}
      </div>

      {(score || markers.length > 0) && (
        <div
          className={cn(
            "relative z-10 mt-auto pt-1",
            compact ? "text-[10px]" : "text-xs"
          )}
          data-relic-score={score ? relic.key : undefined}
        >
          <div className="flex items-center gap-1 font-mono tabular-nums">
            {score &&
              (offTargetMain ? (
                <span
                  className={cn(
                    "flex items-center gap-0.5 rounded px-1 font-bold",
                    gradeClass(score.grade)
                  )}
                  role="img"
                  aria-label={t("scoring.offTargetMain")}
                  title={t("scoring.offTargetMain")}
                >
                  <TriangleAlert className={markerClass} aria-hidden="true" />
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
              ))}
            {markers.length > 0 && (
              <span
                className="flex shrink-0 items-center gap-0.5"
                data-relic-markers
              >
                {markers}
              </span>
            )}
            {score && (
              <span className="ml-auto font-semibold text-amber-100">
                {score.total.toFixed(1)}
              </span>
            )}
          </div>
          {score && (
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
          )}
        </div>
      )}
    </article>
  );
}
