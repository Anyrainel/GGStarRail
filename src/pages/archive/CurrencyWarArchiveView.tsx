import { ArrowRight, ArrowUpRight, Hammer, Link2, Users } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArchiveTabs } from "@/components/archive/ArchiveTabs";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import {
  CollapsibleBody,
  useRowExpansion,
} from "@/components/archive/CollapsibleBody";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { AssetImage } from "@/components/shared/AssetImage";
import { BetaBadge } from "@/components/shared/BetaBadge";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_PATHS } from "@/config/navigation";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useMediaQuery } from "@/hooks/useMediaQuery";
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
} from "@/providers/reference/catalog";
import {
  type CurrencyWarCatalog,
  loadCurrencyWarCatalog,
} from "@/providers/reference/currencyWar";
import type {
  CharacterDefinition,
  CurrencyWarBond,
  CurrencyWarEnvironment,
  CurrencyWarEquipment,
  CurrencyWarStrategy,
  PropertyCatalog,
} from "@/providers/reference/types";
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
  if (resource.data) return <CurrencyWarArchiveContent {...resource.data} />;
  return (
    <div className="container">
      {resource.error ? (
        <CatalogFailure error={resource.error} />
      ) : (
        <CatalogLoading />
      )}
    </div>
  );
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
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const rows = useRowExpansion();
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
  const panelId = "currency-war-panel";
  const tabPanel = (content: ReactNode) => (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={`${panelId}-tab-${activeTab.id}`}
    >
      {content}
    </div>
  );
  const header = (
    <ArchiveToolbar
      searchQuery={query}
      onSearchChange={setQuery}
      searchLabel={t("common.search")}
      searchPlaceholder={t("archive.currencyWar.search")}
      tabs={
        <ArchiveTabs
          panelId={panelId}
          label={t("archive.currencyWar.title")}
          value={activeTab.id}
          options={tabs.map((tab) => ({
            value: tab.id,
            label: t(tab.label),
            count: catalog[tab.id].length,
          }))}
          onValueChange={changeTab}
        />
      }
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
          className="contents"
        />
      )}
      {activeTab.id === "strategies" && (
        <FilterChipGroup
          options={qualities}
          selectedValues={quality}
          onSelectedValuesChange={setQuality}
          getKey={(id) => id}
          getLabel={qualityName}
          className="contents"
        />
      )}
    </ArchiveToolbar>
  );
  const renderCard = (
    record: CurrencyWarRecord,
    collapse?: { expanded: boolean; onToggle: () => void }
  ) => (
    <CurrencyWarDetail
      key={record.id}
      record={record}
      tab={activeTab.id}
      catalog={catalog}
      characters={characters}
      properties={properties}
      onSelect={select}
      collapse={collapse}
    />
  );

  if (activeTab.id === "bonds") {
    const bondSelected = Boolean(
      selectedId && filtered.some((entry) => entry.id === selectedId)
    );
    const bondName = (entry: CurrencyWarRecord) =>
      formatGameText(getLocalizedValue(entry.name, locale));
    return (
      <SidebarDetailLayout
        header={header}
        mobileDetailHeader={header}
        hasSelection={bondSelected}
        onBack={() => setSearchParams({ tab: "bonds" }, { replace: true })}
        backLabel={t("archive.currencyWar.bonds")}
        sidebarLabel={t("archive.currencyWar.results")}
        detailLabel={selected ? bondName(selected) : undefined}
        sidebar={tabPanel(
          filtered.length ? (
            <div className="space-y-0.5">
              {filtered.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={selected?.id === entry.id}
                  onClick={() => select(entry.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    selected?.id === entry.id
                      ? "bg-primary/15 ring-1 ring-primary/30"
                      : "hover:bg-accent/50"
                  )}
                >
                  <AssetImage
                    kind={activeTab.asset}
                    id={entry.id}
                    sourcePath={entry.icon_path}
                    alt=""
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {bondName(entry)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <CatalogEmpty />
          )
        )}
        mobileGrid={tabPanel(
          filtered.length ? (
            <div className="grid grid-cols-3 gap-2 p-2">
              {filtered.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={selected?.id === entry.id}
                  onClick={() => select(entry.id)}
                  className="flex min-w-0 flex-col items-center gap-1 rounded-lg p-2 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <AssetImage
                    kind={activeTab.asset}
                    id={entry.id}
                    sourcePath={entry.icon_path}
                    alt=""
                    className="h-12 w-12 object-contain"
                  />
                  <span className="line-clamp-2 w-full text-center text-sm leading-tight">
                    {bondName(entry)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <CatalogEmpty />
          )
        )}
      >
        {selected ? (
          isDesktop ? (
            renderCard(selected)
          ) : (
            tabPanel(renderCard(selected))
          )
        ) : (
          <CatalogEmpty />
        )}
      </SidebarDetailLayout>
    );
  }

  return (
    <ScrollLayout header={header}>
      {tabPanel(
        filtered.length ? (
          <section
            aria-label={t("archive.currencyWar.results")}
            className="grid items-stretch gap-4 lg:grid-cols-2 xl:grid-cols-3"
          >
            {filtered.map((record, index) => {
              const row = rows.rowOf(index);
              return renderCard(record, {
                expanded: rows.isExpanded(row),
                onToggle: () => rows.toggleRow(row),
              });
            })}
          </section>
        ) : (
          <CatalogEmpty />
        )
      )}
    </ScrollLayout>
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
    <CurrencyWarSection
      title={t("archive.currencyWar.characters")}
      icon={Users}
    >
      <div className="flex flex-wrap gap-1.5">
        {entries.map((character) => (
          <Link
            key={character.id}
            to={`${APP_PATHS.archiveCharacters}?id=${character.id}`}
            className="rounded-md border border-border bg-background/60 px-2 py-1 text-xs font-medium hover:border-primary/60"
          >
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
  collapse,
}: {
  record: CurrencyWarRecord;
  tab: CurrencyWarTab;
  catalog: CurrencyWarCatalog;
  characters: readonly CharacterDefinition[];
  properties: PropertyCatalog;
  onSelect: (id: string) => void;
  /** Grid cards clip long bodies; a selected Bond shows in full. */
  collapse?: { expanded: boolean; onToggle: () => void };
}) {
  const { locale, t } = useI18n();
  const config = tabs.find((entry) => entry.id === tab)!;
  const recommendedCharacterIds =
    "recommended_character_ids" in record
      ? record.recommended_character_ids
      : [];
  const ruleCharacterIds =
    "dress_rule" in record && record.dress_rule === "DressRuleRoleOnly"
      ? record.dress_rule_parameters.map(String)
      : [];
  const recommendationsRepeatRule =
    ruleCharacterIds.length > 0 &&
    recommendedCharacterIds.length > 0 &&
    recommendedCharacterIds.every((id) => ruleCharacterIds.includes(id)) &&
    ruleCharacterIds.every((id) => recommendedCharacterIds.includes(id));
  return (
    <article
      id={`currency-war-card-${record.id}`}
      tabIndex={-1}
      data-testid="currency-war-detail"
      data-strategy-quality={"quality" in record ? record.quality : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-gradient-card p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "quality" in record &&
          (record.quality === "Gold" || record.quality === "Orange") &&
          "border-[hsl(var(--quality-gold)/0.65)] bg-[linear-gradient(135deg,color-mix(in_srgb,hsl(var(--quality-gold))_55%,hsl(var(--card))),color-mix(in_srgb,hsl(var(--quality-gold))_43%,hsl(var(--card))))]",
        "quality" in record &&
          record.quality === "Silver" &&
          "border-[hsl(var(--quality-silver)/0.6)] bg-[linear-gradient(135deg,color-mix(in_srgb,hsl(var(--quality-silver))_50%,hsl(var(--card))),color-mix(in_srgb,hsl(var(--quality-silver))_38%,hsl(var(--card))))]",
        "quality" in record &&
          (record.quality === "Prismatic" || record.quality === "Rainbow") &&
          "border-[hsl(var(--quality-prismatic-purple)/0.6)] bg-[linear-gradient(125deg,hsl(var(--quality-prismatic-blue)/0.2),hsl(var(--quality-prismatic-purple)/0.2)_45%,hsl(var(--quality-gold)/0.1))]"
      )}
    >
      <div className="flex items-start gap-4">
        <ItemIcon
          kind={config.asset}
          id={record.id}
          sourcePath={record.icon_path}
          alt=""
          rarity={null}
          size="lg"
          imageClassName="p-1.5"
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
      <CurrencyWarCardBody collapse={collapse}>
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
          <CurrencyWarSection
            title={t("archive.currencyWar.recipe")}
            icon={Hammer}
          >
            {record.recipes.map((recipe) => (
              <div
                key={recipe.join("-")}
                className="rounded-lg border border-border bg-card/30 p-3"
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
          <CurrencyWarSection
            title={t("archive.currencyWar.upgrades")}
            icon={ArrowUpRight}
          >
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
              icon={Link2}
            >
              <CurrencyWarText
                text={bond.description}
                parameters={bond.parameters}
              />
              <CurrencyWarBondTiers
                tiers={bond.tiers}
                properties={properties}
              />
            </CurrencyWarSection>
          ))}
        {"remarks" in record && record.remarks.length > 0 && (
          <div className="space-y-2 rounded-lg border border-border bg-card/30 p-3">
            {record.remarks.map((remark) => (
              <CurrencyWarText
                key={
                  ("description" in remark ? remark.description : remark).en
                    .value
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
        {"recommended_character_ids" in record &&
          !recommendationsRepeatRule && (
            <CurrencyWarCharacterLinks
              ids={record.recommended_character_ids}
              characters={characters}
            />
          )}
      </CurrencyWarCardBody>
    </article>
  );
}

/** Long card bodies clip to 18rem in the grid; the fade sits on the content. */
function CurrencyWarCardBody({
  collapse,
  children,
}: {
  collapse?: { expanded: boolean; onToggle: () => void };
  children: ReactNode;
}) {
  if (!collapse) return <div className="space-y-3">{children}</div>;
  return (
    <CollapsibleBody
      expanded={collapse.expanded}
      onToggle={collapse.onToggle}
      maxHeight={288}
      contentClassName="space-y-3"
    >
      {children}
    </CollapsibleBody>
  );
}
