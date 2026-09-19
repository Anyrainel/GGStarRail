import { ArrowRight, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArchiveTabs } from "@/components/archive/ArchiveTabs";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { AssetImage } from "@/components/shared/AssetImage";
import { BetaBadge } from "@/components/shared/BetaBadge";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_PATHS } from "@/config/navigation";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { isArchiveSearchActive } from "@/lib/archiveFilters";
import { characterCatalogName } from "@/lib/catalogPresentation";
import { formatGameText } from "@/lib/gameText";
import { cn } from "@/lib/utils";
import {
  getLocalizedValue,
  loadCharacters,
  loadPropertyTables,
} from "@/providers/gilore/catalog";
import {
  type CurrencyWarCatalog,
  loadCurrencyWarCatalog,
} from "@/providers/gilore/currencyWar";
import type {
  CharacterDefinition,
  CurrencyWarBond,
  CurrencyWarEnvironment,
  CurrencyWarEquipment,
  CurrencyWarStrategy,
  PropertyCatalog,
} from "@/providers/gilore/types";
import { CatalogEmpty, CatalogFailure, CatalogLoading } from "./CatalogStatus";
import {
  CurrencyWarBondTiers,
  CurrencyWarProperties,
  CurrencyWarSection,
  CurrencyWarText,
  currencyWarSearchText,
} from "./CurrencyWarDetails";
import { CurrencyWarEquipmentRules } from "./CurrencyWarEquipmentRules";

const tabs = [
  {
    id: "equipment",
    label: "archive.currencyWar.equipment",
    asset: "currency-war-equipment",
    member: "currency_war_equipment",
  },
  {
    id: "environments",
    label: "archive.currencyWar.environments",
    asset: "currency-war-environment",
    member: "currency_war_environments",
  },
  {
    id: "strategies",
    label: "archive.currencyWar.strategies",
    asset: "currency-war-strategy",
    member: "currency_war_strategies",
  },
  {
    id: "bonds",
    label: "archive.currencyWar.bonds",
    asset: "currency-war-bond",
    member: "currency_war_bonds",
  },
] as const;
type CurrencyWarTab = (typeof tabs)[number]["id"];
type CurrencyWarRecord =
  | CurrencyWarEquipment
  | CurrencyWarEnvironment
  | CurrencyWarStrategy
  | CurrencyWarBond;

const qualityLabels: Readonly<Record<string, MessageKey>> = {
  White: "archive.currencyWar.quality.white",
  Blue: "archive.currencyWar.quality.blue",
  Purple: "archive.currencyWar.quality.purple",
  Orange: "archive.currencyWar.quality.gold",
  Gold: "archive.currencyWar.quality.gold",
  Silver: "archive.currencyWar.quality.silver",
  Rainbow: "archive.currencyWar.quality.rainbow",
  Prismatic: "archive.currencyWar.quality.rainbow",
};

async function loadArchive() {
  const [catalog, characters, properties] = await Promise.all([
    loadCurrencyWarCatalog(),
    loadCharacters(),
    loadPropertyTables(),
  ]);
  return { catalog, characters: characters.values, properties };
}

export function CurrencyWarArchiveView() {
  const resource = useCatalogResource(loadArchive);
  if (resource.loading) return <CatalogLoading />;
  if (resource.error) return <CatalogFailure error={resource.error} />;
  if (!resource.data) return null;
  return <CurrencyWarArchiveContent {...resource.data} />;
}

export function CurrencyWarArchiveContent({
  catalog,
  characters,
  properties,
}: {
  catalog: CurrencyWarCatalog;
  characters: readonly CharacterDefinition[];
  properties: PropertyCatalog;
}) {
  const { locale, t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab =
    tabs.find((tab) => tab.id === searchParams.get("tab")) ?? tabs[0];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Set<string>>(new Set());
  const [quality, setQuality] = useState<Set<string>>(new Set());
  const selectedId = searchParams.get("id");
  const records: readonly CurrencyWarRecord[] = catalog[activeTab.id];
  useEffect(() => {
    if (!selectedId || activeTab.id === "bonds") return;
    const card = document.getElementById(`currency-war-card-${selectedId}`);
    card?.scrollIntoView?.({ block: "nearest" });
    card?.focus({ preventScroll: true });
  }, [selectedId, activeTab.id]);
  const searchIndex = useMemo(
    () =>
      new Map(records.map((entry) => [entry.id, currencyWarSearchText(entry)])),
    [records]
  );
  const filtered = useMemo(
    () =>
      records
        .filter((entry) => {
          if (!isArchiveSearchActive(query)) {
            if (
              category.size &&
              "category" in entry &&
              !category.has(entry.category_name.en.value)
            )
              return false;
            if (
              quality.size &&
              "quality" in entry &&
              !quality.has(entry.quality)
            )
              return false;
          }
          return (
            !query.trim() ||
            searchIndex
              .get(entry.id)
              ?.includes(query.trim().toLocaleLowerCase())
          );
        })
        .sort((a, b) =>
          getLocalizedValue(a.name, locale).localeCompare(
            getLocalizedValue(b.name, locale),
            locale
          )
        ),
    [records, category, quality, query, searchIndex, locale]
  );
  const selected =
    filtered.find((entry) => entry.id === selectedId) ?? filtered[0];
  const categories = [
    ...new Map(
      catalog.equipment.map((entry) => [
        entry.category_name.en.value,
        entry.category_name,
      ])
    ).entries(),
  ];
  const qualities = [
    ...new Set(catalog.strategies.map((entry) => entry.quality)),
  ];
  const qualityName = (value: string) =>
    qualityLabels[value] ? t(qualityLabels[value]) : t("common.unknown");
  const changeTab = (tab: CurrencyWarTab) => {
    setQuery("");
    setCategory(new Set());
    setQuality(new Set());
    setSearchParams({ tab }, { replace: true });
  };
  const select = (id: string) => {
    setQuery("");
    setCategory(new Set());
    setQuality(new Set());
    setSearchParams({ tab: activeTab.id, id }, { replace: true });
  };
  const header = (
    <div className="space-y-3">
      <ArchiveToolbar
        searchQuery={query}
        onSearchChange={setQuery}
        searchLabel={t("common.search")}
        searchPlaceholder={t("archive.currencyWar.search")}
      >
        {activeTab.id === "equipment" && (
          <FilterChipGroup
            options={categories.map(([id]) => id)}
            selectedValues={category}
            onSelectedValuesChange={setCategory}
            getKey={(id) => id}
            getLabel={(id) =>
              getLocalizedValue(
                categories.find(([key]) => key === id)![1],
                locale
              )
            }
          />
        )}
        {activeTab.id === "strategies" && (
          <FilterChipGroup
            options={qualities}
            selectedValues={quality}
            onSelectedValuesChange={setQuality}
            getKey={(id) => id}
            getLabel={qualityName}
          />
        )}
      </ArchiveToolbar>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("archive.results", {
          shown: filtered.length,
          total: records.length,
        })}
      </p>
    </div>
  );
  const renderCard = (record: CurrencyWarRecord) => (
    <CurrencyWarDetail
      key={record.id}
      record={record}
      tab={activeTab.id}
      catalog={catalog}
      characters={characters}
      properties={properties}
      onSelect={select}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="container shrink-0 pb-3">
        <ArchiveTabs
          panelId="currency-war-panel"
          label={t("archive.currencyWar.title")}
          value={activeTab.id}
          options={tabs.map((tab) => ({
            value: tab.id,
            label: t(tab.label),
            count: catalog[tab.id].length,
          }))}
          onValueChange={changeTab}
        />
      </div>
      <div
        id="currency-war-panel"
        role="tabpanel"
        aria-labelledby={`currency-war-panel-tab-${activeTab.id}`}
        className="min-h-0 flex-1"
      >
        {activeTab.id === "bonds" ? (
          <SidebarDetailLayout
            header={header}
            mobileDetailHeader={header}
            hasSelection={Boolean(
              selectedId && filtered.some((entry) => entry.id === selectedId)
            )}
            onBack={() => setSearchParams({ tab: "bonds" }, { replace: true })}
            backLabel={t("archive.currencyWar.bonds")}
            sidebarLabel={t("archive.currencyWar.results")}
            sidebar={
              <div className="space-y-1">
                {filtered.length ? (
                  filtered.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      aria-pressed={selected?.id === entry.id}
                      onClick={() => select(entry.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        selected?.id === entry.id
                          ? "bg-primary/15 ring-1 ring-primary/30"
                          : "hover:bg-accent"
                      )}
                    >
                      <AssetImage
                        kind={activeTab.asset}
                        id={entry.id}
                        sourcePath={entry.icon_path}
                        alt=""
                        className="h-10 w-10 shrink-0 object-contain"
                      />
                      <span className="min-w-0 flex-1 font-semibold">
                        {formatGameText(getLocalizedValue(entry.name, locale))}
                      </span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </button>
                  ))
                ) : (
                  <CatalogEmpty />
                )}
              </div>
            }
          >
            {selected ? renderCard(selected) : <CatalogEmpty />}
          </SidebarDetailLayout>
        ) : (
          <ScrollLayout header={header}>
            {filtered.length ? (
              <section
                aria-label={t("archive.currencyWar.results")}
                className="grid items-stretch gap-4 lg:grid-cols-2 xl:grid-cols-3"
              >
                {filtered.map(renderCard)}
              </section>
            ) : (
              <CatalogEmpty />
            )}
          </ScrollLayout>
        )}
      </div>
    </div>
  );
}

export function CurrencyWarCharacterLinks({
  ids,
  characters,
}: {
  ids: readonly string[];
  characters: readonly CharacterDefinition[];
}) {
  const { locale, t } = useI18n();
  const entries = ids.flatMap((id) => {
    const entry = characters.find((character) => character.id === id);
    return entry ? [entry] : [];
  });
  if (!entries.length) return null;
  return (
    <CurrencyWarSection title={t("archive.currencyWar.characters")}>
      <div className="flex flex-wrap gap-2">
        {entries.map((character) => (
          <Link
            key={character.id}
            to={`${APP_PATHS.archiveCharacters}?id=${character.id}`}
            className="flex items-center gap-2 rounded-lg border border-border bg-background/60 py-1.5 pl-1.5 pr-3 text-xs font-medium hover:border-primary/60"
          >
            <AssetImage
              kind="character"
              id={character.id}
              sourcePath={character.icon_path}
              alt=""
              className="h-9 w-9 rounded-md object-cover"
            />
            {characterCatalogName(character, locale, t("terms.trailblazer"))}
          </Link>
        ))}
      </div>
    </CurrencyWarSection>
  );
}

function EquipmentReferences({
  ids,
  equipment,
  onSelect,
}: {
  ids: readonly string[];
  equipment: readonly CurrencyWarEquipment[];
  onSelect: (id: string) => void;
}) {
  const { locale } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {[...new Set(ids)].map((id) => {
        const item = equipment.find((entry) => entry.id === id);
        if (!item) return null;
        return (
          <Button
            key={id}
            variant="outline"
            className="h-auto min-h-10 max-w-full whitespace-normal px-2 py-1.5 text-left text-xs"
            onClick={() => onSelect(id)}
          >
            <AssetImage
              kind="currency-war-equipment"
              id={id}
              sourcePath={item.icon_path}
              alt=""
              className="h-8 w-8 shrink-0 object-contain"
            />
            {getLocalizedValue(item.name, locale)}
            {ids.filter((value) => value === id).length > 1 && (
              <span>×{ids.filter((value) => value === id).length}</span>
            )}
            <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
          </Button>
        );
      })}
    </div>
  );
}

function CurrencyWarDetail({
  record,
  tab,
  catalog,
  characters,
  properties,
  onSelect,
}: {
  record: CurrencyWarRecord;
  tab: CurrencyWarTab;
  catalog: CurrencyWarCatalog;
  characters: readonly CharacterDefinition[];
  properties: PropertyCatalog;
  onSelect: (id: string) => void;
}) {
  const { locale, t } = useI18n();
  const config = tabs.find((entry) => entry.id === tab)!;
  return (
    <article
      id={`currency-war-card-${record.id}`}
      tabIndex={-1}
      data-testid="currency-war-detail"
      data-strategy-quality={"quality" in record ? record.quality : undefined}
      className={cn(
        "min-w-0 space-y-4 rounded-xl border border-border bg-gradient-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "quality" in record &&
          (record.quality === "Gold" || record.quality === "Orange") &&
          "border-[hsl(var(--quality-gold)/0.5)] bg-[linear-gradient(135deg,hsl(var(--quality-gold)/0.16),hsl(var(--card))_70%)]",
        "quality" in record &&
          record.quality === "Silver" &&
          "border-[hsl(var(--quality-silver)/0.45)] bg-[linear-gradient(135deg,hsl(var(--quality-silver)/0.14),hsl(var(--card))_70%)]",
        "quality" in record &&
          (record.quality === "Prismatic" || record.quality === "Rainbow") &&
          "border-[hsl(var(--quality-prismatic-purple)/0.6)] bg-[linear-gradient(125deg,hsl(var(--quality-prismatic-blue)/0.2),hsl(var(--quality-prismatic-purple)/0.2)_45%,hsl(var(--quality-gold)/0.1))]"
      )}
    >
      <div className="flex items-start gap-4">
        <AssetImage
          kind={config.asset}
          id={record.id}
          sourcePath={record.icon_path}
          alt=""
          className="h-16 w-16 shrink-0 rounded-xl bg-secondary/60 object-contain p-1.5"
        />
        <div className="min-w-0 space-y-2">
          <h2 className="break-words text-lg font-semibold">
            {formatGameText(getLocalizedValue(record.name, locale))}
          </h2>
          {"category_name" in record && (
            <Badge variant="secondary">
              {getLocalizedValue(record.category_name, locale)}
            </Badge>
          )}
          {"quality" in record && (
            <Badge variant="secondary">
              {qualityLabels[record.quality]
                ? t(qualityLabels[record.quality])
                : t("common.unknown")}
            </Badge>
          )}
          <BetaBadge member={config.member} id={record.id} />
        </div>
      </div>
      <CurrencyWarText
        text={record.description}
        parameters={record.parameters}
      />
      {"dress_rule" in record && (
        <CurrencyWarEquipmentRules
          equipment={record}
          characters={characters}
          bonds={catalog.bonds}
        />
      )}
      {"tags" in record && record.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {record.tags.map((tag) => (
            <Badge variant="outline" key={tag.en.value}>
              {getLocalizedValue(tag, locale)}
            </Badge>
          ))}
        </div>
      )}
      {"properties" in record && (
        <CurrencyWarProperties
          values={record.properties}
          properties={properties}
        />
      )}
      {"recipes" in record && record.recipes.length > 0 && (
        <CurrencyWarSection title={t("archive.currencyWar.recipe")}>
          {record.recipes.map((recipe) => (
            <div
              key={recipe.join("-")}
              className="rounded-xl border border-border bg-background/40 p-3"
            >
              <EquipmentReferences
                ids={recipe}
                equipment={catalog.equipment}
                onSelect={onSelect}
              />
            </div>
          ))}
        </CurrencyWarSection>
      )}
      {"upgrade_ids" in record && record.upgrade_ids.length > 0 && (
        <CurrencyWarSection title={t("archive.currencyWar.upgrades")}>
          <EquipmentReferences
            ids={record.upgrade_ids}
            equipment={catalog.equipment}
            onSelect={onSelect}
          />
        </CurrencyWarSection>
      )}
      {"tiers" in record && (
        <CurrencyWarBondTiers tiers={record.tiers} properties={properties} />
      )}
      {"sub_bonds" in record &&
        record.sub_bonds.map((bond) => (
          <CurrencyWarSection
            key={bond.id}
            title={getLocalizedValue(bond.name, locale)}
          >
            <CurrencyWarText
              text={bond.description}
              parameters={bond.parameters}
            />
            <CurrencyWarBondTiers tiers={bond.tiers} properties={properties} />
          </CurrencyWarSection>
        ))}
      {"remarks" in record && record.remarks.length > 0 && (
        <div className="space-y-3 rounded-xl border border-border bg-secondary/35 p-3">
          {record.remarks.map((remark) => (
            <CurrencyWarText
              key={
                ("description" in remark ? remark.description : remark).en.value
              }
              text={"description" in remark ? remark.description : remark}
              parameters={
                "parameters" in remark ? remark.parameters : record.parameters
              }
            />
          ))}
        </div>
      )}
      {"character_ids" in record && (
        <CurrencyWarCharacterLinks
          ids={record.character_ids}
          characters={characters}
        />
      )}
      {"recommended_character_ids" in record && (
        <CurrencyWarCharacterLinks
          ids={record.recommended_character_ids}
          characters={characters}
        />
      )}
    </article>
  );
}
