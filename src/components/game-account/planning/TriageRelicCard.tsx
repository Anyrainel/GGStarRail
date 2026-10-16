import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { useId } from "react";
import { RelicStatDisplay } from "@/components/game-account/RelicStatDisplay";
import { AssetImage } from "@/components/shared/AssetImage";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { GradeBadge } from "@/components/shared/FieldControls";
import { ItemIcon } from "@/components/shared/ItemIcon";
import type { RelicTriageEvaluation } from "@/domain/build/evaluation";
import type { BuildConfiguration } from "@/domain/build/schemas";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import {
  characterCatalogName,
  localizedName,
  localizedPropertyName,
} from "@/services/catalog/presentation";
import { shortStatKey } from "@/services/catalog/relicPresentation";
import { TRIAGE_DECISION, TRIAGE_REASON_KEY } from "./triagePresentation";

const RARITY_TEXT: Readonly<Record<number, string>> = {
  5: "text-[hsl(var(--quality-gold))]",
  4: "text-[hsl(var(--quality-prismatic-purple))]",
};

/** A compact triage row that expands into stats, reasons, and matching builds. */
export function TriageRelicCard({
  evaluation,
  references,
  buildsById,
  expanded,
  onToggle,
}: {
  evaluation: RelicTriageEvaluation;
  references: BuildReferences;
  buildsById: ReadonlyMap<string, BuildConfiguration>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { locale, t } = useI18n();
  const detailId = useId();
  const { relic, result } = evaluation;
  const piece = references.relicPieces.byId.get(relic.definitionId);
  const pieceName = localizedName(piece?.name, locale, relic.definitionId);
  const setName = localizedName(
    references.relicSets.byId.get(relic.setId)?.name,
    locale,
    relic.setId
  );
  const slotName = localizedName(
    references.properties.relicSlotById.get(CATALOG_RELIC_SLOT[relic.slot])
      ?.name,
    locale,
    relic.slot
  );
  const mainStatName = localizedPropertyName(
    relic.mainStat.statId,
    references.properties,
    locale
  );
  const mainStatKey = shortStatKey(relic.mainStat.statId);
  const mainStatShort = mainStatKey ? t(mainStatKey) : mainStatName;
  const decision = TRIAGE_DECISION[result.decision];
  const reasons = result.reasons.map((reason) => t(TRIAGE_REASON_KEY[reason]));
  // The last reason decides the result (a protection or the score band).
  const decidingReason = reasons.at(-1);
  const matchCount = evaluation.matchingBuildIds.length;
  const matchingBuilds = evaluation.matchingBuildIds.flatMap((buildId) => {
    const build = buildsById.get(buildId);
    if (!build) return [];
    const character = references.characters.byId.get(
      build.characterDefinitionId
    );
    return [
      {
        id: buildId,
        name: build.name,
        character,
        characterName: character
          ? characterCatalogName(character, locale, t("terms.trailblazer"))
          : build.characterDefinitionId,
      },
    ];
  });
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <article
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-gradient-card text-card-foreground shadow-sm"
      data-triage-decision={result.decision}
    >
      <div className="flex min-w-0 items-center gap-3 p-3">
        <CatalogHoverCard
          kind="relic-piece"
          id={relic.definitionId}
          relic={relic}
        >
          <ItemIcon
            kind="relic-piece"
            id={piece?.id ?? relic.definitionId}
            sourcePath={piece?.icon_path ?? ""}
            alt={`${pieceName}, +${relic.level}`}
            rarity={relic.rarity}
            level={`+${relic.level}`}
            locked={relic.locked}
            size="sm"
            tabIndex={0}
            className="shrink-0"
          />
        </CatalogHoverCard>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-md text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      RARITY_TEXT[relic.rarity]
                    )}
                    title={pieceName}
                  >
                    {setName}
                  </span>
                  <GradeBadge grade={evaluation.grade} />
                </span>
                <span
                  className="block truncate text-xs text-muted-foreground"
                  title={`${slotName} · ${mainStatName}`}
                >
                  {slotName} · {mainStatShort}
                </span>
              </span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center self-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  decision.badgeClass
                )}
              >
                {t(decision.labelKey)}
              </span>
            </span>
            {decidingReason && (
              <span className="mt-0.5 flex min-w-0 items-start gap-1 text-xs text-[hsl(var(--quality-gold))]">
                <Info className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{decidingReason}</span>
              </span>
            )}
          </span>
          <Chevron
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
      </div>
      {expanded && (
        <div
          id={detailId}
          className="flex flex-1 gap-4 border-t border-border bg-card/60 p-3"
        >
          <div className="w-36 shrink-0 overflow-hidden rounded-lg bg-card/60">
            <RelicStatDisplay
              relic={relic}
              references={references}
              locale={locale}
              slotName={slotName}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-xs">
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">{t("triage.score")}</span>
              <span className="font-mono text-sm tabular-nums">
                {evaluation.score.toFixed(1)}
              </span>
            </p>
            <ul className="space-y-0.5 text-[hsl(var(--quality-gold))]">
              {reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-1">
                  <Info className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">{reason}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-t border-border pt-1.5">
              <p className="text-muted-foreground">
                {t(
                  matchCount === 1
                    ? "triage.matchingBuildsOne"
                    : "triage.matchingBuilds",
                  { count: matchCount }
                )}
              </p>
              {matchingBuilds.map((build) => (
                <p
                  key={build.id}
                  className="flex min-w-0 items-center gap-1.5"
                  title={build.name}
                >
                  {build.character && (
                    <AssetImage
                      kind="character"
                      variant="round"
                      id={build.character.id}
                      sourcePath={build.character.icon_path}
                      alt=""
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 rounded-full bg-muted object-cover object-top"
                    />
                  )}
                  <span className="truncate">{build.characterName}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
