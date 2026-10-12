import { CheckCircle2, XCircle } from "lucide-react";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { ItemIcon, type ItemIconSize } from "@/components/shared/ItemIcon";
import {
  RelicSlotGrid,
  RelicSlotPlaceholder,
} from "@/components/shared/relic/RelicSlotGrid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScoredRelic } from "@/domain/build/evaluation";
import type { BuildFilterMatch } from "@/domain/build/filters";
import type { Relic } from "@/domain/game-account/schemas";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import { localizedName } from "@/services/catalog/presentation";
import type { RelicSlotId } from "@/services/catalog/relicPresentation";

const TITLE_CLASS = "text-base leading-tight md:text-xl";

export interface LoadoutRecommendation {
  selected: Partial<Record<RelicSlotId, ScoredRelic>>;
  missingSlots: readonly RelicSlotId[];
  complete: boolean;
  averageScore: number | null;
}

/** The best account piece per slot as a 4 + 2 icon strip. */
export function RecommendedLoadoutCard({
  recommendation,
  references,
}: {
  recommendation: LoadoutRecommendation;
  references: BuildReferences;
}) {
  const { locale, t } = useI18n();
  const slotName = (slot: RelicSlotId) =>
    localizedName(
      references.properties.relicSlotById.get(CATALOG_RELIC_SLOT[slot])?.name,
      locale,
      slot
    );
  return (
    <Card className="bg-gradient-card" data-filter-loadout>
      <CardHeader className="p-3 md:px-6 md:pb-3 md:pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className={TITLE_CLASS}>
            {t("filters.recommendationTitle")}
          </CardTitle>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={recommendation.complete ? "secondary" : "outline"}>
              {recommendation.complete
                ? t("filters.loadoutComplete")
                : t("filters.loadoutMissing", {
                    count: recommendation.missingSlots.length,
                  })}
            </Badge>
            <Badge className="tabular-nums">
              {t("scoring.average", {
                value: recommendation.averageScore?.toFixed(1) ?? "—",
              })}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 md:px-6 md:pb-4">
        <RelicSlotGrid
          maxIconSize="lg"
          className="max-w-2xl"
          renderSlot={(slot, size) => {
            const entry = recommendation.selected[slot];
            if (!entry) {
              return (
                <div
                  className="flex flex-col items-center gap-1"
                  title={t("filters.noCandidate", { slot: slotName(slot) })}
                >
                  <RelicSlotPlaceholder label={slotName(slot)} size={size} />
                  <span className="text-[11px] text-muted-foreground md:text-xs">
                    —
                  </span>
                </div>
              );
            }
            return (
              <LoadoutPiece
                relic={entry.relic}
                score={entry.score}
                references={references}
                size={size}
              />
            );
          }}
        />
      </CardContent>
    </Card>
  );
}

function LoadoutPiece({
  relic,
  score,
  references,
  size,
}: {
  relic: Relic;
  score: ScoredRelic["score"];
  references: BuildReferences;
  size: ItemIconSize;
}) {
  const { locale } = useI18n();
  const piece = references.relicPieces.byId.get(relic.definitionId);
  const pieceName = localizedName(piece?.name, locale, relic.definitionId);
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <CatalogHoverCard
        kind="relic-piece"
        id={relic.definitionId}
        relic={relic}
      >
        <ItemIcon
          kind="relic-piece"
          id={piece?.id ?? relic.definitionId}
          sourcePath={piece?.icon_path ?? ""}
          alt={`${pieceName}, +${relic.level}, ${score.total.toFixed(1)}`}
          rarity={relic.rarity}
          level={`+${relic.level}`}
          locked={relic.locked}
          size={size}
          tabIndex={0}
        />
      </CatalogHoverCard>
      <span className="flex items-center gap-1 text-[11px] tabular-nums md:text-xs">
        {score.grade && (
          <span className="font-semibold text-primary">{score.grade}</span>
        )}
        <span>{score.total.toFixed(1)}</span>
      </span>
    </div>
  );
}

/** Pass/fail summary for one candidate: one verdict plus only the failed checks. */
export function MatchSummary({ match }: { match: BuildFilterMatch }) {
  const { t } = useI18n();
  const failedLabel = (reason: BuildFilterMatch["reasons"][number]) => {
    switch (reason) {
      case "slot":
        return t("filters.reason.slotMissing");
      case "set":
        return t("filters.reason.setMissing");
      case "main-stat":
        return t("filters.reason.mainStatMissing");
      case "weighted-substats":
        return t("filters.reason.substatsMissing");
      case "minimum-score":
        return t("filters.reason.scoreMissing");
    }
  };
  const criteria = [
    "slot",
    "set",
    "main-stat",
    "weighted-substats",
    "minimum-score",
  ] as const satisfies BuildFilterMatch["reasons"];
  const failed = match.matches
    ? []
    : criteria.filter((reason) => !match.reasons.includes(reason));
  const Icon = match.matches ? CheckCircle2 : XCircle;
  return (
    <div className="flex flex-wrap gap-1.5" data-match={match.matches}>
      <Badge
        variant="outline"
        className={cn(
          "gap-1",
          match.matches
            ? "border-primary/40 bg-primary/15 text-primary"
            : "border-destructive/40 bg-destructive/10 text-destructive"
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {match.matches ? t("filters.matches") : t("filters.doesNotMatch")}
      </Badge>
      {failed.map((reason) => (
        <Badge key={reason} variant="outline" className="text-muted-foreground">
          {failedLabel(reason)}
        </Badge>
      ))}
    </div>
  );
}
