import type { ReactNode } from "react";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Badge } from "@/components/ui/badge";
import type { Relic, RelicSlot } from "@/domain/account/schemas";
import type { RelicScore } from "@/domain/build/scoring";
import { useI18n } from "@/i18n/I18nContext";
import type { Locale } from "@/i18n/locales";
import type { BuildReferences } from "@/lib/buildReferences";
import {
  formatAccountStatValue,
  localizedName,
} from "@/lib/catalogPresentation";
import { cn } from "@/lib/utils";
import type { RelicSlotId } from "@/providers/gilore/types";
import { GradeBadge } from "./BuildControls";

const DOMAIN_SLOT_TO_CATALOG = {
  head: "HEAD",
  hands: "HAND",
  body: "BODY",
  feet: "FOOT",
  planarSphere: "NECK",
  linkRope: "OBJECT",
} as const satisfies Record<RelicSlot, RelicSlotId>;

interface RelicScoreCardProps {
  relic: Relic;
  references: BuildReferences;
  locale: Locale;
  score?: Pick<RelicScore, "total" | "grade">;
  selected?: boolean;
  children?: ReactNode;
  className?: string;
}

export function RelicScoreCard({
  relic,
  references,
  locale,
  score,
  selected,
  children,
  className,
}: RelicScoreCardProps) {
  const { t } = useI18n();
  const piece = references.relicPieces.byId.get(relic.definitionId);
  const setDefinition = references.relicSets.byId.get(relic.setId);
  const slotDefinition = references.properties.relicSlotById.get(
    DOMAIN_SLOT_TO_CATALOG[relic.slot]
  );
  const mainProperty = references.properties.propertyById.get(
    relic.mainStat.statId
  );
  const pieceName = localizedName(piece?.name, locale, relic.definitionId);

  return (
    <article
      className={cn(
        "min-w-0 rounded-xl border border-border bg-gradient-card p-3 shadow-lg",
        selected && "border-primary/45",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <ItemIcon
          kind="relic-piece"
          id={piece?.id ?? relic.definitionId}
          sourcePath={piece?.icon_path ?? ""}
          alt={`${pieceName}, +${relic.level}`}
          rarity={relic.rarity}
          level={`+${relic.level}`}
          locked={relic.locked}
          size="md"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-semibold leading-5">
                {pieceName}
              </h3>
              <p className="truncate text-xs text-muted-foreground">
                {localizedName(setDefinition?.name, locale, relic.setId)}
              </p>
            </div>
            {score && (
              <div className="flex shrink-0 items-center gap-1.5">
                <GradeBadge grade={score.grade} />
                <span className="min-w-10 text-right text-sm font-semibold tabular-nums">
                  {score.total.toFixed(1)}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-xs">
              {localizedName(slotDefinition?.name, locale, relic.slot)}
            </Badge>
            {relic.equippedCharacterKey && (
              <Badge variant="outline" className="text-xs">
                {t("field.equipped")}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-2 text-xs">
        <span className="min-w-0 truncate text-muted-foreground">
          {localizedName(
            mainProperty?.relic_name ?? mainProperty?.name,
            locale,
            relic.mainStat.statId
          )}
        </span>
        <span className="shrink-0 font-medium tabular-nums">
          {formatAccountStatValue(relic.mainStat.value, mainProperty, locale)}
        </span>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </article>
  );
}
