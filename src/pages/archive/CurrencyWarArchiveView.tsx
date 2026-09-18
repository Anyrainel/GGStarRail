import {
  ArrowRight,
  Boxes,
  ChevronRight,
  Coins,
  Network,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AssetImage } from "@/components/shared/AssetImage";
import { BetaBadge } from "@/components/shared/BetaBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_PATHS } from "@/config/navigation";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
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
    icon: Boxes,
    asset: "currency-war-equipment",
    member: "currency_war_equipment",
  },
  {
    id: "environments",
    label: "archive.currencyWar.environments",
    icon: TrendingUp,
    asset: "currency-war-environment",
    member: "currency_war_environments",
  },
  {
    id: "strategies",
    label: "archive.currencyWar.strategies",
    icon: Sparkles,
    asset: "currency-war-strategy",
    member: "currency_war_strategies",
  },
  {
    id: "bonds",
    label: "archive.currencyWar.bonds",
    icon: Network,
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
  const [category, setCategory] = useState("all");
  const [quality, setQuality] = useState("all");
  const selectedId = searchParams.get("id");
  const sheet = useCatalogDetailSheet();
  const records: readonly CurrencyWarRecord[] = catalog[activeTab.id];
  const setDetailOpen = sheet.setOpen;
  useEffect(() => {
    if (
      selectedId &&
      records.some((entry) => entry.id === selectedId) &&
      window.matchMedia("(max-width: 1023px)").matches
    )
      setDetailOpen(true);
  }, [selectedId, records, setDetailOpen]);
  const searchIndex = useMemo(
    () =>
      new Map(records.map((entry) => [entry.id, currencyWarSearchText(entry)])),
    [records]
  );
  const filtered = useMemo(
    () =>
      records
        .filter((entry) => {
          if (
            category !== "all" &&
            "category" in entry &&
            entry.category_name.en.value !== category
          )
            return false;
          if (
            quality !== "all" &&
            "quality" in entry &&
            entry.quality !== quality
          )
            return false;
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
    qualityLabels[value] ? t(qualityLabels[value]) : value;
  const changeTab = (tab: CurrencyWarTab) => {
    setQuery("");
    setCategory("all");
    setQuality("all");
    sheet.setOpen(false);
    setSearchParams({ tab }, { replace: true });
  };
  const select = (id: string, trigger?: HTMLButtonElement) => {
    if (!trigger) {
      setQuery("");
      setCategory("all");
      setQuality("all");
    }
    setSearchParams({ tab: activeTab.id, id }, { replace: true });
    if (trigger) sheet.openOnNarrowScreen(trigger);
  };
  const detail = selected ? (
    <CurrencyWarDetail
      record={selected}
      tab={activeTab.id}
      catalog={catalog}
      characters={characters}
      properties={properties}
      onSelect={select}
    />
  ) : null;

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-2xl border border-border bg-card/70 p-3 sm:p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-xl bg-primary/15 p-2.5 text-primary">
            <Coins className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold">
            {t("archive.currencyWar.title")}
          </h2>
        </div>
        <div
          role="tablist"
          aria-label={t("archive.currencyWar.title")}
          className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-background/65 p-1.5 lg:grid-cols-4"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              id={`currency-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab.id === tab.id}
              aria-controls="currency-war-panel"
              tabIndex={activeTab.id === tab.id ? 0 : -1}
              onClick={() => changeTab(tab.id)}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % tabs.length
                    : event.key === "ArrowLeft"
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : null;
                if (next === null) return;
                event.preventDefault();
                changeTab(tabs[next].id);
                document
                  .getElementById(`currency-tab-${tabs[next].id}`)
                  ?.focus();
              }}
              className={cn(
                "flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
                activeTab.id === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card hover:bg-secondary"
              )}
            >
              <tab.icon
                className="hidden h-4 w-4 shrink-0 sm:block"
                aria-hidden="true"
              />
              <span className="min-w-0">{t(tab.label)}</span>
              <span
                className={cn(
                  "ml-1 rounded-md px-1.5 py-0.5 text-[10px] tabular-nums",
                  activeTab.id === tab.id
                    ? "bg-primary-foreground/15"
                    : "bg-secondary"
                )}
              >
                {catalog[tab.id].length}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div
        id="currency-war-panel"
        role="tabpanel"
        aria-labelledby={`currency-tab-${activeTab.id}`}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/55 p-3 sm:flex-row sm:items-end">
          <CatalogSearch
            value={query}
            onChange={setQuery}
            placeholderKey="archive.currencyWar.search"
          />
          {activeTab.id === "equipment" && (
            <CatalogSelect
              labelKey="archive.currencyWar.category"
              value={category}
              onChange={setCategory}
            >
              <option value="all">
                {t("archive.currencyWar.allCategories")}
              </option>
              {categories.map(([id, name]) => (
                <option key={id} value={id}>
                  {getLocalizedValue(name, locale)}
                </option>
              ))}
            </CatalogSelect>
          )}
          {activeTab.id === "strategies" && (
            <CatalogSelect
              labelKey="archive.currencyWar.tier"
              value={quality}
              onChange={setQuality}
            >
              <option value="all">{t("archive.currencyWar.allTiers")}</option>
              {qualities.map((value) => (
                <option key={value} value={value}>
                  {qualityName(value)}
                </option>
              ))}
            </CatalogSelect>
          )}
          {(query || category !== "all" || quality !== "all") && (
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setQuality("all");
              }}
            >
              {t("filter.reset")}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("archive.results", {
            shown: filtered.length,
            total: records.length,
          })}
        </p>
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
          <section
            aria-label={t("archive.currencyWar.results")}
            className="grid gap-2 sm:grid-cols-2 lg:max-h-[calc(100dvh-19rem)] lg:grid-cols-1 lg:overflow-y-auto lg:rounded-xl lg:border lg:border-border lg:bg-card/20 lg:p-2"
          >
            {filtered.length ? (
              filtered.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  data-currency-id={entry.id}
                  aria-pressed={selected?.id === entry.id}
                  onClick={(event) => select(entry.id, event.currentTarget)}
                  className={cn(
                    "group flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    selected?.id === entry.id
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-card/70 hover:border-primary/45 hover:bg-secondary/55"
                  )}
                >
                  <AssetImage
                    kind={activeTab.asset}
                    id={entry.id}
                    sourcePath={entry.icon_path}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg bg-secondary/60 object-contain p-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold">
                      {formatGameText(getLocalizedValue(entry.name, locale))}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {"category_name" in entry
                        ? getLocalizedValue(entry.category_name, locale)
                        : "quality" in entry
                          ? qualityName(entry.quality)
                          : formatGameText(
                              getLocalizedValue(entry.description, locale) ??
                                "",
                              entry.parameters,
                              t("terms.trailblazer")
                            )}
                    </span>
                    <BetaBadge member={activeTab.member} id={entry.id} />
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
          </section>
          {detail && (
            <>
              <div className="hidden min-w-0 lg:block">{detail}</div>
              <CatalogDetailSheet
                open={sheet.open}
                onOpenChange={sheet.setOpen}
                onCloseAutoFocus={sheet.restoreTriggerFocus}
                title={selected ? getLocalizedValue(selected.name, locale) : ""}
              >
                {detail}
              </CatalogDetailSheet>
            </>
          )}
        </div>
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
    <aside
      data-testid="currency-war-detail"
      className="min-w-0 space-y-5 rounded-2xl border border-border bg-card/75 p-4 sm:p-5"
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
          <p className="text-xs font-medium text-muted-foreground">
            {t(config.label)}
          </p>
          <h2 className="break-words text-xl font-semibold">
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
                : record.quality}
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
            <Badge variant="outline" key={tag.en.provenance.source_reference}>
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
                ("description" in remark ? remark.description : remark).en
                  .provenance.source_reference
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
    </aside>
  );
}
