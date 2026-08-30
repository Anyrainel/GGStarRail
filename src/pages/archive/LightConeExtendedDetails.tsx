import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/gameText";
import { getLocalizedValue } from "@/providers/gilore/catalog";
import type {
  LightConeDefinitionV1_1,
  ProgressionItem,
  PropertyCatalogV1_1,
} from "@/providers/gilore/types";
import {
  createProgressionItemIndex,
  ExactItemIds,
  ExperienceItemSection,
  ParameterValues,
  PropertyValues,
} from "./ProgressionDetails";

export function lightConeExtendedSearchText(
  lightCone: LightConeDefinitionV1_1
): string {
  const values = [
    lightCone.effect.id,
    ...lightCone.rank_up_material_ids,
    ...lightCone.promotions.flatMap((promotion) =>
      promotion.costs.map((cost) => cost.item_id)
    ),
  ];
  for (const row of lightCone.effect.superimpositions) {
    values.push(
      row.ability_name,
      ...row.properties.map((property) => property.property_id),
      row.name.en.value,
      row.name["zh-CN"].value,
      row.description.en.value,
      row.description["zh-CN"].value
    );
  }
  return values.join(" ");
}

export function LightConeExtendedDetails({
  lightCone,
  progressionItems,
  propertyTables,
}: {
  lightCone: LightConeDefinitionV1_1;
  progressionItems: readonly ProgressionItem[];
  propertyTables: PropertyCatalogV1_1;
}) {
  const { locale, t } = useI18n();
  const trailblazer = t("terms.trailblazer");
  const itemById = createProgressionItemIndex(progressionItems);
  return (
    <>
      <details
        data-testid="light-cone-superimpositions"
        className="rounded-lg border border-border bg-background/45 p-3"
      >
        <summary className="cursor-pointer font-semibold">
          {t("archive.superimpositions", {
            value: lightCone.effect.superimpositions.length,
          })}
        </summary>
        <div className="mt-3 space-y-2">
          {lightCone.effect.superimpositions.map((row) => (
            <details
              key={row.level}
              data-superimposition-level={row.level}
              className="rounded-md border border-border bg-background/45 p-3"
            >
              <summary className="cursor-pointer font-medium">
                S{row.level} ·{" "}
                {formatGameText(
                  getLocalizedValue(row.name, locale),
                  [],
                  trailblazer
                )}
              </summary>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline">
                    {t("archive.superimposition", { value: row.level })}
                  </Badge>
                  <span>{t("archive.abilityId")}</span>
                  <code>{row.ability_name}</code>
                </div>
                <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                  {formatGameText(
                    getLocalizedValue(row.description, locale),
                    row.parameters,
                    trailblazer
                  )}
                </p>
                <ParameterValues values={row.parameters} />
                <PropertyValues
                  values={row.properties}
                  propertyTables={propertyTables}
                />
              </div>
            </details>
          ))}
        </div>
      </details>

      <details
        data-testid="light-cone-rank-materials"
        className="rounded-lg border border-border bg-background/45 p-3"
      >
        <summary className="cursor-pointer font-semibold">
          {t("archive.rankUpMaterials", {
            value: lightCone.rank_up_material_ids.length,
          })}
        </summary>
        <div className="mt-3">
          <ExactItemIds
            itemIds={lightCone.rank_up_material_ids}
            itemById={itemById}
          />
        </div>
      </details>

      <ExperienceItemSection items={progressionItems} kind="light-cone" />
    </>
  );
}
