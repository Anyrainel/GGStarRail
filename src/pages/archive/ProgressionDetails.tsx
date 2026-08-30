import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/I18nContext";
import { formatCatalogValue, formatGameText } from "@/lib/gameText";
import { getLocalizedValue } from "@/providers/gilore/catalog";
import type {
  CostItem,
  ProgressionItem,
  PropertyCatalog,
  PropertyValue,
} from "@/providers/gilore/types";

export type ProgressionItemIndex = ReadonlyMap<string, ProgressionItem>;

export function createProgressionItemIndex(
  items: readonly ProgressionItem[]
): ProgressionItemIndex {
  return new Map(items.map((item) => [item.id, item]));
}

export function ParameterValues({
  values,
  kind = "parameters",
}: {
  values: readonly number[];
  kind?: "parameters" | "display" | "simple";
}) {
  const { t } = useI18n();
  if (values.length === 0) return null;
  const label =
    kind === "display"
      ? t("archive.displayParameters")
      : kind === "simple"
        ? t("archive.simpleParameters")
        : t("archive.parameters");
  return (
    <p className="break-words text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span>{" "}
      <code>{values.map(String).join(" · ")}</code>
    </p>
  );
}

export function PropertyValues({
  values,
  propertyTables,
}: {
  values: readonly PropertyValue[];
  propertyTables: PropertyCatalog;
}) {
  const { locale, t } = useI18n();
  if (values.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">
        {t("archive.propertyValues", { value: values.length })}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {values.map((value) => {
          const property = propertyTables.propertyById.get(value.property_id);
          const localizedName = getLocalizedValue(
            property?.relic_name ?? property?.name,
            locale
          );
          return (
            <div
              key={value.property_id}
              className="rounded-md border border-border bg-background/45 p-2 text-xs"
            >
              <div className="flex justify-between gap-2">
                <span>
                  {localizedName
                    ? formatGameText(localizedName)
                    : t("archive.sourceValueMissing")}
                </span>
                <span className="font-mono">
                  {formatCatalogValue(
                    value.value,
                    property?.value_kind ?? "unknown"
                  )}
                </span>
              </div>
              <code className="mt-1 block text-[10px] text-muted-foreground">
                {value.property_id}
              </code>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressionItemReference({
  itemId,
  count,
  itemById,
}: {
  itemId: string;
  count?: number;
  itemById: ProgressionItemIndex;
}) {
  const { locale, t } = useI18n();
  const item = itemById.get(itemId);
  const localizedName = item
    ? formatGameText(getLocalizedValue(item.name, locale))
    : t("archive.itemNameMissing");
  const provenance = item?.name[locale].provenance;
  return (
    <div
      data-item-id={itemId}
      className="rounded-md border border-border bg-background/45 p-2 text-xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{localizedName}</span>
        <code className="text-muted-foreground">{itemId}</code>
        {count !== undefined && <Badge variant="outline">×{count}</Badge>}
      </div>
      {item && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.character_experience !== null && (
            <Badge variant="secondary">
              {t("archive.characterExperienceValue", {
                value: item.character_experience,
              })}
            </Badge>
          )}
          {item.light_cone_experience !== null && (
            <Badge variant="secondary">
              {t("archive.lightConeExperienceValue", {
                value: item.light_cone_experience,
              })}
            </Badge>
          )}
          {item.light_cone_feed_credit_cost !== null && (
            <Badge variant="outline">
              {t("archive.feedCreditValue", {
                value: item.light_cone_feed_credit_cost,
              })}
            </Badge>
          )}
        </div>
      )}
      {provenance && (
        <details className="mt-2 text-[10px] text-muted-foreground">
          <summary className="cursor-pointer">
            {t("archive.itemProvenance")}
          </summary>
          <code className="mt-1 block break-all">
            {provenance.source_revision}
          </code>
          <p className="mt-1 break-all">{provenance.source_path}</p>
          <code className="mt-1 block break-all">{provenance.source_key}</code>
        </details>
      )}
    </div>
  );
}

export function MaterialCosts({
  costs,
  itemById,
  showHeading = true,
}: {
  costs: readonly CostItem[];
  itemById: ProgressionItemIndex;
  showHeading?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      {showHeading && (
        <p className="text-xs font-medium">
          {t("archive.materialCosts", { value: costs.length })}
        </p>
      )}
      {costs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("archive.noMaterialCosts")}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {costs.map((cost) => (
            <ProgressionItemReference
              key={cost.item_id}
              itemId={cost.item_id}
              count={cost.count}
              itemById={itemById}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ExactItemIds({
  itemIds,
  itemById,
}: {
  itemIds: readonly string[];
  itemById: ProgressionItemIndex;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">
        {t("archive.rankUpMaterials", { value: itemIds.length })}
      </p>
      {itemIds.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("archive.noMaterialCosts")}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {itemIds.map((itemId) => (
            <ProgressionItemReference
              key={itemId}
              itemId={itemId}
              itemById={itemById}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ExperienceItemSection({
  items,
  kind,
}: {
  items: readonly ProgressionItem[];
  kind: "character" | "light-cone";
}) {
  const { t } = useI18n();
  const relevant = items.filter((item) =>
    kind === "character"
      ? item.character_experience !== null
      : item.light_cone_experience !== null ||
        item.light_cone_feed_credit_cost !== null
  );
  const itemById = createProgressionItemIndex(items);
  return (
    <details className="rounded-lg border border-border bg-background/45 p-3">
      <summary className="cursor-pointer font-semibold">
        {kind === "character"
          ? t("archive.characterExperienceItems", { value: relevant.length })
          : t("archive.lightConeExperienceItems", { value: relevant.length })}
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {relevant.map((item) => (
          <ProgressionItemReference
            key={item.id}
            itemId={item.id}
            itemById={itemById}
          />
        ))}
      </div>
    </details>
  );
}
