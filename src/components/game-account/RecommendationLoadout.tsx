import { ItemIcon } from "@/components/shared/ItemIcon";
import { RelicKindIcon } from "@/components/shared/relic/RelicKindIcon";
import { BUILD_SLOT_ORDER, type ScoredRelic } from "@/domain/build/evaluation";
import {
  type Relic,
  type RelicSlot,
  relicCategory,
} from "@/domain/game-account/schemas";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import {
  formatAccountStatValue,
  localizedName,
  localizedPropertyName,
} from "@/services/catalog/presentation";

export function RecommendationLoadout({
  selected,
  current,
  references,
  potentialByKey,
  unscoredRelics = [],
  recommended = false,
}: {
  selected: Partial<Record<RelicSlot, ScoredRelic>>;
  current: Partial<Record<RelicSlot, ScoredRelic>>;
  references: BuildReferences;
  potentialByKey?: ReadonlyMap<string, number>;
  unscoredRelics?: readonly Relic[];
  recommended?: boolean;
}) {
  const { t, locale } = useI18n();
  return (
    <div
      className="space-y-4"
      data-recommendation-loadout={recommended ? "recommended" : "current"}
    >
      {(["cavern", "planar"] as const).map((category) => (
        <section key={category} className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <RelicKindIcon kind={category} decorative />
            {t(category === "cavern" ? "scoreUp.cavern" : "scoreUp.planar")}
          </h3>
          <div
            className={cn(
              "grid grid-cols-2 gap-2",
              category === "cavern" && "lg:grid-cols-4"
            )}
          >
            {BUILD_SLOT_ORDER.filter(
              (slot) => relicCategory(slot) === category
            ).map((slot) => {
              const unscored = unscoredRelics.find(
                (relic) => relic.slot === slot
              );
              const entry =
                selected[slot] ??
                (unscored ? { relic: unscored, score: undefined } : undefined);
              const slotDefinition = references.properties.relicSlotById.get(
                CATALOG_RELIC_SLOT[slot]
              );
              const slotName = localizedName(
                slotDefinition?.name,
                locale,
                slot
              );
              const changed =
                entry && current[slot]?.relic.key !== entry.relic.key;
              const piece =
                entry &&
                references.relicPieces.byId.get(entry.relic.definitionId);
              const set =
                entry && references.relicSets.byId.get(entry.relic.setId);
              return (
                <article
                  key={slot}
                  data-recommendation-slot={slot}
                  className={cn(
                    "min-w-0 rounded-lg border border-border bg-background p-3",
                    recommended && changed && "border-primary bg-primary/5"
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-xs">
                    <span className="font-medium">{slotName}</span>
                    {recommended && entry && (
                      <span
                        className={
                          changed ? "text-primary" : "text-muted-foreground"
                        }
                      >
                        {t(changed ? "scoreUp.changed" : "scoreUp.retained")}
                      </span>
                    )}
                  </div>
                  {entry ? (
                    <>
                      <div className="flex items-center gap-3">
                        <ItemIcon
                          kind="relic-piece"
                          id={entry.relic.definitionId}
                          sourcePath={piece?.icon_path ?? ""}
                          alt={localizedName(
                            piece?.name,
                            locale,
                            entry.relic.definitionId
                          )}
                          rarity={entry.relic.rarity}
                          level={`+${entry.relic.level}`}
                          locked={entry.relic.locked}
                          size="sm"
                        />
                        <div className="min-w-0 space-y-1 text-sm font-semibold tabular-nums">
                          <p>
                            {t("scoreUp.pieceScore", {
                              score: entry.score?.total.toFixed(1) ?? "—",
                            })}
                          </p>
                          {potentialByKey?.has(entry.relic.key) && (
                            <p
                              className="text-xs font-normal text-muted-foreground"
                              title={t("scoreUp.potentialRule")}
                            >
                              {t("scoreUp.potential", {
                                score: potentialByKey
                                  .get(entry.relic.key)!
                                  .toFixed(1),
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-xs font-medium">
                        {localizedName(set?.name, locale, entry.relic.setId)}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          entry.score?.mainStatAccepted === false &&
                            "text-destructive"
                        )}
                      >
                        {localizedPropertyName(
                          entry.relic.mainStat.statId,
                          references.properties,
                          locale
                        )}{" "}
                        {formatAccountStatValue(
                          entry.relic.mainStat.value,
                          references.properties.propertyById.get(
                            entry.relic.mainStat.statId
                          ),
                          locale
                        )}
                      </p>
                      <dl className="mt-2 space-y-1 text-xs">
                        {entry.relic.substats.map((stat) => (
                          <div
                            key={stat.statId}
                            className={cn(
                              "flex justify-between gap-1",
                              (entry.score?.contributions[stat.statId]
                                ?.weight ?? 0) === 0 && "text-muted-foreground"
                            )}
                          >
                            <dt className="min-w-0 truncate">
                              {localizedPropertyName(
                                stat.statId,
                                references.properties,
                                locale
                              )}
                            </dt>
                            <dd className="shrink-0 tabular-nums">
                              {formatAccountStatValue(
                                stat.value,
                                references.properties.propertyById.get(
                                  stat.statId
                                ),
                                locale
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t("characterLoadout.emptySlot")}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
