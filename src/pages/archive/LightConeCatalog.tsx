import { useEffect, useMemo, useState } from "react";
import { BetaBadge } from "@/components/shared/BetaBadge";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { TRAILBLAZER_TERMS } from "@/i18n/gameTerms";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/gameText";
import {
  getLocalizedValue,
  isLightConeDefinitionV1_1,
  isProgressionTablesV1_1,
  loadLightCones,
  loadProgression,
  loadPropertyTables,
} from "@/providers/gilore/catalog";
import type {
  LightConeDefinition,
  ProgressionItem,
  ProgressionTables,
  PropertyCatalog,
} from "@/providers/gilore/types";
import {
  CatalogEmpty,
  CatalogFailure,
  CatalogLoading,
  CatalogSearch,
  CatalogSelect,
} from "./CatalogControls";
import {
  CatalogDetailSheet,
  useCatalogDetailSheet,
} from "./CatalogDetailSheet";
import { CatalogSourceDisclosure } from "./CatalogSourceDisclosure";
import {
  LightConeExtendedDetails,
  lightConeExtendedSearchText,
} from "./LightConeExtendedDetails";
import {
  createProgressionItemIndex,
  MaterialCosts,
} from "./ProgressionDetails";

async function loadLightConeArchiveData() {
  const [lightCones, propertyTables, progression] = await Promise.all([
    loadLightCones(),
    loadPropertyTables(),
    loadProgression(),
  ]);
  return { lightCones, propertyTables, progression };
}

function searchable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function LightConeCatalog() {
  const { locale, t } = useI18n();
  const resource = useCatalogResource(loadLightConeArchiveData);
  const [query, setQuery] = useState("");
  const [pathId, setPathId] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const {
    open: detailOpen,
    setOpen: setDetailOpen,
    openOnNarrowScreen,
    restoreTriggerFocus,
  } = useCatalogDetailSheet();

  const searchIndex = useMemo(() => {
    if (!resource.data) return new Map<string, string>();
    const progressionById = new Map<string, ProgressionItem>(
      isProgressionTablesV1_1(resource.data.progression)
        ? resource.data.progression.items.map((item) => [item.id, item])
        : []
    );
    return new Map(
      resource.data.lightCones.values.map((lightCone) => {
        const localizedValues = (["en", "zh-CN"] as const).flatMap(
          (searchLocale) =>
            [
              getLocalizedValue(lightCone.name, searchLocale),
              getLocalizedValue(lightCone.effect.name, searchLocale),
              getLocalizedValue(lightCone.description, searchLocale),
              getLocalizedValue(lightCone.effect.description, searchLocale),
              getLocalizedValue(lightCone.background_description, searchLocale),
            ].map((value) =>
              formatGameText(value, [], TRAILBLAZER_TERMS[searchLocale])
            )
        );
        const itemIds = isLightConeDefinitionV1_1(lightCone)
          ? [
              ...lightCone.rank_up_material_ids,
              ...lightCone.promotions.flatMap((promotion) =>
                promotion.costs.map((cost) => cost.item_id)
              ),
            ]
          : [];
        const progressionItemValues = itemIds.flatMap((itemId) => {
          const item = progressionById.get(itemId);
          return item
            ? [item.name.en.value, item.name["zh-CN"].value]
            : [itemId];
        });
        const extended = isLightConeDefinitionV1_1(lightCone)
          ? formatGameText(
              lightConeExtendedSearchText(lightCone),
              [],
              `${TRAILBLAZER_TERMS.en} ${TRAILBLAZER_TERMS["zh-CN"]}`
            )
          : "";
        return [
          lightCone.id,
          searchable(
            [
              ...localizedValues,
              ...progressionItemValues,
              lightCone.id,
              extended,
            ].join(" ")
          ),
        ];
      })
    );
  }, [resource.data]);

  const filtered = useMemo(() => {
    if (!resource.data) return [];
    const needle = searchable(query);
    return [...resource.data.lightCones.values]
      .filter((lightCone) => {
        if (pathId !== "all" && lightCone.path_id !== pathId) return false;
        if (rarity !== "all" && lightCone.rarity !== Number(rarity))
          return false;
        if (!needle) return true;
        return searchIndex.get(lightCone.id)?.includes(needle) ?? false;
      })
      .sort((left, right) => {
        const rarityOrder = right.rarity - left.rarity;
        if (rarityOrder !== 0) return rarityOrder;
        return formatGameText(
          getLocalizedValue(left.name, locale)
        ).localeCompare(
          formatGameText(getLocalizedValue(right.name, locale)),
          locale
        );
      });
  }, [locale, pathId, query, rarity, resource.data, searchIndex]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((entry) => entry.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  if (resource.loading) return <CatalogLoading />;
  if (resource.error) return <CatalogFailure error={resource.error} />;
  if (!resource.data) return null;

  const { lightCones, propertyTables, progression } = resource.data;
  const selected = selectedId ? lightCones.byId.get(selectedId) : undefined;
  const selectedPath = selected
    ? propertyTables.pathById.get(selected.path_id)
    : undefined;
  const selectedName = selected
    ? formatGameText(getLocalizedValue(selected.name, locale))
    : "";
  const selectedDetail = selected ? (
    <LightConeDetail
      lightCone={selected}
      pathName={
        selectedPath
          ? formatGameText(getLocalizedValue(selectedPath.name, locale))
          : selected.path_id
      }
      progression={progression}
      propertyTables={propertyTables}
    />
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/55 p-3 xl:flex-row xl:items-end">
        <CatalogSearch
          value={query}
          onChange={setQuery}
          placeholderKey="archive.search.lightCones"
        />
        <div className="flex flex-wrap gap-3">
          <CatalogSelect
            labelKey="filter.path"
            value={pathId}
            onChange={setPathId}
          >
            <option value="all">{t("filter.allPaths")}</option>
            {propertyTables.paths.map((path) => (
              <option key={path.id} value={path.id}>
                {formatGameText(getLocalizedValue(path.name, locale))}
              </option>
            ))}
          </CatalogSelect>
          <CatalogSelect
            labelKey="filter.rarity"
            value={rarity}
            onChange={setRarity}
          >
            <option value="all">{t("filter.allRarities")}</option>
            <option value="5">5 ★</option>
            <option value="4">4 ★</option>
            <option value="3">3 ★</option>
          </CatalogSelect>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("archive.results", {
          shown: filtered.length,
          total: lightCones.values.length,
        })}
      </p>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <section
          className="grid gap-2 sm:grid-cols-2 lg:max-h-[calc(100dvh-15rem)] lg:grid-cols-1 lg:overflow-y-auto lg:rounded-xl lg:border lg:border-border lg:bg-card/20 lg:p-2"
          aria-label={t("archive.lightConeList")}
        >
          {filtered.length === 0 ? (
            <CatalogEmpty />
          ) : (
            filtered.map((lightCone) => (
              <LightConeCard
                key={lightCone.id}
                lightCone={lightCone}
                selected={lightCone.id === selected?.id}
                pathName={formatGameText(
                  getLocalizedValue(
                    propertyTables.pathById.get(lightCone.path_id)?.name,
                    locale
                  ) ?? lightCone.path_id
                )}
                onSelect={(trigger) => {
                  setSelectedId(lightCone.id);
                  openOnNarrowScreen(trigger);
                }}
              />
            ))
          )}
        </section>
        {selectedDetail && (
          <>
            <div className="hidden min-w-0 lg:block">{selectedDetail}</div>
            <CatalogDetailSheet
              open={detailOpen}
              onOpenChange={setDetailOpen}
              onCloseAutoFocus={restoreTriggerFocus}
              title={selectedName}
            >
              {selectedDetail}
            </CatalogDetailSheet>
          </>
        )}
      </div>
    </div>
  );
}

function LightConeCard({
  lightCone,
  selected,
  pathName,
  onSelect,
}: {
  lightCone: LightConeDefinition;
  selected: boolean;
  pathName: string;
  onSelect: (trigger: HTMLButtonElement) => void;
}) {
  const { locale } = useI18n();
  const name = formatGameText(getLocalizedValue(lightCone.name, locale));
  return (
    <button
      type="button"
      onClick={(event) => onSelect(event.currentTarget)}
      aria-pressed={selected}
      data-light-cone-id={lightCone.id}
      className="group overflow-hidden rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        className={
          selected
            ? "h-full border-primary/60 bg-primary/10"
            : "h-full transition-colors group-hover:border-primary/35 group-hover:bg-secondary/45"
        }
      >
        <CardContent className="flex items-center gap-3 p-2.5">
          <ItemIcon
            kind="light-cone"
            id={lightCone.id}
            sourcePath={lightCone.icon_path}
            alt={name}
            rarity={lightCone.rarity}
            size="md"
          />
          <span className="min-w-0 space-y-1.5">
            <span className="line-clamp-2 block font-semibold">{name}</span>
            <BetaBadge member="light_cones" id={lightCone.id} />
            <span className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{pathName}</Badge>
            </span>
          </span>
        </CardContent>
      </Card>
    </button>
  );
}

function LightConeDetail({
  lightCone,
  pathName,
  progression,
  propertyTables,
}: {
  lightCone: LightConeDefinition;
  pathName: string;
  progression: ProgressionTables;
  propertyTables: PropertyCatalog;
}) {
  const { locale, t } = useI18n();
  const name = formatGameText(getLocalizedValue(lightCone.name, locale));
  const provenance = lightCone.name[locale].provenance;
  const trailblazer = t("terms.trailblazer");
  const additiveLightCone = isLightConeDefinitionV1_1(lightCone)
    ? lightCone
    : null;
  const additiveProgression = isProgressionTablesV1_1(progression)
    ? progression
    : null;
  const additivePropertyTables =
    propertyTables.schemaVersion === "1.0.0" ? null : propertyTables;
  const itemById = additiveProgression
    ? createProgressionItemIndex(additiveProgression.items)
    : null;
  return (
    <aside
      data-testid="light-cone-detail"
      className="min-w-0 space-y-5 overflow-hidden rounded-xl border border-border bg-card/75 p-4 lg:sticky lg:top-0"
    >
      <div className="flex gap-4">
        <ItemIcon
          kind="light-cone"
          id={lightCone.id}
          sourcePath={lightCone.icon_path}
          alt={name}
          rarity={lightCone.rarity}
          size="xl"
        />
        <div className="min-w-0 space-y-2">
          <h2 className="text-xl font-semibold">{name}</h2>
          <BetaBadge member="light_cones" id={lightCone.id} />
          <div className="flex flex-wrap gap-2">
            <Badge>{pathName}</Badge>
            <Badge variant="outline">
              {t("archive.superimpositionMax", {
                value: lightCone.max_superimposition,
              })}
            </Badge>
          </div>
        </div>
      </div>
      <p className="break-words whitespace-pre-line text-sm leading-6 text-muted-foreground">
        {formatGameText(
          getLocalizedValue(lightCone.description, locale),
          [],
          trailblazer
        )}
      </p>

      <section className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
        <h3 className="font-semibold">
          {formatGameText(
            getLocalizedValue(lightCone.effect.name, locale),
            [],
            trailblazer
          )}
        </h3>
        <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {formatGameText(
            getLocalizedValue(lightCone.effect.description, locale),
            lightCone.effect.superimpositions[0]?.parameters,
            trailblazer
          )}
        </p>
      </section>

      {additiveLightCone && additiveProgression && additivePropertyTables ? (
        <LightConeExtendedDetails
          lightCone={additiveLightCone}
          progressionItems={additiveProgression.items}
          propertyTables={additivePropertyTables}
        />
      ) : (
        <p className="rounded-lg border border-border bg-background/45 p-3 text-xs leading-5 text-muted-foreground">
          {t("archive.additiveUnavailable")}
        </p>
      )}

      <details className="rounded-lg border border-border bg-background/45 p-3">
        <summary className="cursor-pointer font-semibold">
          {itemById
            ? t("archive.promotionsWithCosts", {
                promotions: lightCone.promotions.length,
              })
            : t("archive.progression")}
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3">{t("archive.promotion")}</th>
                <th className="pb-2 pr-3">{t("archive.maxLevel")}</th>
                <th className="pb-2 pr-3">HP</th>
                <th className="pb-2 pr-3">ATK</th>
                <th className="pb-2">DEF</th>
              </tr>
            </thead>
            <tbody>
              {lightCone.promotions.map((promotion) => (
                <tr
                  key={promotion.promotion}
                  className="border-t border-border"
                >
                  <td className="py-2 pr-3">{promotion.promotion}</td>
                  <td className="py-2 pr-3">{promotion.max_level}</td>
                  <td className="py-2 pr-3">{promotion.stats.hp.base_value}</td>
                  <td className="py-2 pr-3">
                    {promotion.stats.attack.base_value}
                  </td>
                  <td className="py-2">{promotion.stats.defence.base_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {itemById && (
          <div className="mt-3 space-y-2">
            {lightCone.promotions.map((promotion) => (
              <details
                key={promotion.promotion}
                className="rounded-md border border-border p-2"
              >
                <summary className="cursor-pointer text-xs font-medium">
                  {t("archive.promotionRequired", {
                    value: promotion.promotion,
                  })}
                </summary>
                <div className="mt-2">
                  <MaterialCosts costs={promotion.costs} itemById={itemById} />
                </div>
              </details>
            ))}
          </div>
        )}
      </details>

      <details className="rounded-lg border border-border bg-background/45 p-3">
        <summary className="cursor-pointer font-semibold">
          {t("archive.story")}
        </summary>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {formatGameText(
            getLocalizedValue(lightCone.background_description, locale),
            [],
            trailblazer
          )}
        </p>
      </details>

      <CatalogSourceDisclosure
        revision={provenance.source_revision}
        path={provenance.source_path}
      />
    </aside>
  );
}
