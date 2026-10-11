import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArchiveChipDivider,
  ArchiveToolbar,
} from "@/components/archive/ArchiveToolbar";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { AssetImage } from "@/components/shared/AssetImage";
import { BetaBadge } from "@/components/shared/BetaBadge";
import { CharacterBadgeGroup } from "@/components/shared/CharacterBadgeGroup";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Card, CardContent } from "@/components/ui/card";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { TRAILBLAZER_TERMS } from "@/i18n/gameTerms";
import { useI18n } from "@/i18n/I18nContext";
import {
  filterArchiveItems,
  isArchiveSearchActive,
} from "@/lib/archiveFilters";
import { characterCatalogName } from "@/lib/catalogPresentation";
import { formatGameText } from "@/lib/gameText";
import { compareReleaseVersionsDescending } from "@/lib/releaseVersion";
import { cn } from "@/lib/utils";
import {
  getLocalizedValue,
  loadCharacters,
  loadPropertyTables,
} from "@/providers/reference/catalog";
import type {
  CharacterDefinition,
  PropertyCatalog,
} from "@/providers/reference/types";
import { CatalogEmpty, CatalogFailure, CatalogLoading } from "./CatalogStatus";
import { CharacterBaseStats } from "./CharacterBaseStats";
import { CharacterCurrencyWarDetails } from "./CharacterCurrencyWarDetails";
import {
  CharacterExtendedDetails,
  characterExtendedSearchText,
} from "./CharacterExtendedDetails";
import type { CharacterDescriptionMode } from "./CharacterSkillCard";
import { CurrencyWarText, currencyWarSearchText } from "./CurrencyWarDetails";

async function loadCharacterArchiveData() {
  const [characters, propertyTables] = await Promise.all([
    loadCharacters(),
    loadPropertyTables(),
  ]);
  return { characters, propertyTables };
}

export function CharacterCatalog() {
  const { t } = useI18n();
  const resource = useCatalogResource(loadCharacterArchiveData);
  const [query, setQuery] = useState("");
  const [paths, setPaths] = useState<Set<string>>(new Set());
  const [combatTypes, setCombatTypes] = useState<Set<string>>(new Set());
  const [rarities, setRarities] = useState<Set<number>>(new Set());
  const [descriptionMode, setDescriptionMode] =
    useState<CharacterDescriptionMode>("full");
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("id")
  );
  const [mobileDetailOpen, setMobileDetailOpen] = useState(
    Boolean(searchParams.get("id"))
  );
  const searching = isArchiveSearchActive(query);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    const linkedId = searchParams.get("id");
    if (!linkedId || !resource.data?.characters.byId.has(linkedId)) return;
    setSelectedId(linkedId);
    setMobileDetailOpen(true);
  }, [searchParams, resource.data]);

  const searchIndex = useMemo(
    () =>
      new Map(
        resource.data?.characters.values.map((character) => [
          character.id,
          formatGameText(
            [
              ...(["en", "zh-CN"] as const).map((language) =>
                characterCatalogName(
                  character,
                  language,
                  TRAILBLAZER_TERMS[language]
                )
              ),
              currencyWarSearchText(character.description),
              characterExtendedSearchText(character),
              currencyWarSearchText(character.currency_war),
            ].join(" "),
            [],
            `${TRAILBLAZER_TERMS.en} ${TRAILBLAZER_TERMS["zh-CN"]}`
          ).toLocaleLowerCase(),
        ]) ?? []
      ),
    [resource.data]
  );

  const filtered = useMemo(
    () =>
      filterArchiveItems(
        resource.data?.characters.values ?? [],
        query,
        (character, needle) =>
          searchIndex.get(character.id)?.includes(needle.toLocaleLowerCase()) ??
          false,
        (character) =>
          (!paths.size || paths.has(character.path_id)) &&
          (!combatTypes.size || combatTypes.has(character.combat_type_id)) &&
          (!rarities.size || rarities.has(character.rarity))
      ).sort(
        (left, right) =>
          compareReleaseVersionsDescending(
            left.release_version,
            right.release_version
          ) ||
          right.rarity - left.rarity ||
          Number(right.id) - Number(left.id)
      ),
    [resource.data, query, searchIndex, paths, combatTypes, rarities]
  );

  useEffect(() => {
    // Preserve incoming deep links until the async catalog has actually loaded.
    if (!resource.data) return;
    if (selectedId && filtered.some((entry) => entry.id === selectedId)) return;
    // Phones open on the grid; only the desktop master-detail picks the first.
    const next = isDesktop ? (filtered[0]?.id ?? null) : null;
    if (next !== selectedId) setSelectedId(next);
  }, [filtered, selectedId, resource.data, isDesktop]);

  const header = (
    <ArchiveToolbar
      searchQuery={query}
      onSearchChange={setQuery}
      searchLabel={t("common.search")}
      searchPlaceholder={t("archive.search.characters")}
    >
      {resource.data && (
        <CharacterFilterChips
          propertyTables={resource.data.propertyTables}
          combatTypes={combatTypes}
          onCombatTypesChange={setCombatTypes}
          rarities={rarities}
          onRaritiesChange={setRarities}
          paths={paths}
          onPathsChange={setPaths}
          disabled={searching}
        />
      )}
    </ArchiveToolbar>
  );
  const layout = {
    className: "h-full min-h-0",
    header,
    onBack: () => setMobileDetailOpen(false),
    backLabel: t("archive.backToCharacters"),
    detailLabel: t("archive.characterDetails"),
  };
  if (!resource.data) {
    const status = resource.error ? (
      <CatalogFailure error={resource.error} />
    ) : (
      <CatalogLoading />
    );
    return (
      <SidebarDetailLayout
        {...layout}
        sidebar={status}
        mobileGrid={status}
        hasSelection={false}
      >
        {null}
      </SidebarDetailLayout>
    );
  }
  const { characters, propertyTables } = resource.data;
  const selected = selectedId ? characters.byId.get(selectedId) : undefined;
  const select = (id: string) => {
    setSelectedId(id);
    setMobileDetailOpen(true);
  };
  const empty = filtered.length === 0;
  return (
    <SidebarDetailLayout
      {...layout}
      sidebar={
        <section
          className="space-y-0.5"
          aria-label={t("archive.characterList")}
        >
          <p className="px-2 text-xs text-muted-foreground" aria-live="polite">
            {t(
              filtered.length === 1
                ? "archive.characterCountOne"
                : "archive.characterCount",
              { count: filtered.length }
            )}
          </p>
          {empty ? (
            <CatalogEmpty />
          ) : (
            filtered.map((character) => (
              <CharacterListRow
                key={character.id}
                character={character}
                selected={character.id === selectedId}
                propertyTables={propertyTables}
                onSelect={() => select(character.id)}
              />
            ))
          )}
        </section>
      }
      mobileGrid={
        <section aria-label={t("archive.characterList")}>
          {empty ? (
            <CatalogEmpty />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 p-2">
              {filtered.map((character) => (
                <CharacterGridTile
                  key={character.id}
                  character={character}
                  selected={character.id === selectedId}
                  onSelect={() => select(character.id)}
                />
              ))}
            </div>
          )}
        </section>
      }
      hasSelection={mobileDetailOpen && Boolean(selected)}
    >
      {selected ? (
        <CharacterDetail
          key={selected.id}
          character={selected}
          propertyTables={propertyTables}
          descriptionMode={descriptionMode}
          onDescriptionModeChange={setDescriptionMode}
        />
      ) : null}
    </SidebarDetailLayout>
  );
}

function CharacterFilterChips({
  propertyTables,
  combatTypes,
  onCombatTypesChange,
  rarities,
  onRaritiesChange,
  paths,
  onPathsChange,
  disabled,
}: {
  propertyTables: PropertyCatalog;
  combatTypes: ReadonlySet<string>;
  onCombatTypesChange: (values: Set<string>) => void;
  rarities: ReadonlySet<number>;
  onRaritiesChange: (values: Set<number>) => void;
  paths: ReadonlySet<string>;
  onPathsChange: (values: Set<string>) => void;
  disabled: boolean;
}) {
  const { locale } = useI18n();
  const combatTypeName = (id: string) =>
    getLocalizedValue(propertyTables.combatTypeById.get(id)?.name, locale) ??
    id;
  const pathName = (id: string) =>
    formatGameText(
      getLocalizedValue(propertyTables.pathById.get(id)?.name, locale) ?? id
    );
  return (
    <>
      <FilterChipGroup
        options={propertyTables.combatTypes.map((entry) => entry.id)}
        selectedValues={combatTypes}
        onSelectedValuesChange={onCombatTypesChange}
        getKey={(id) => id}
        getTitle={combatTypeName}
        getLabel={(id) => (
          <span className="hidden sm:inline">{combatTypeName(id)}</span>
        )}
        getIcon={(id) => (
          <AssetImage
            kind="combat-type"
            id={id}
            sourcePath={propertyTables.combatTypeById.get(id)?.icon_path}
            alt=""
            className="h-4 w-4"
          />
        )}
        className="contents"
        disabled={disabled}
      />
      <ArchiveChipDivider />
      <FilterChipGroup
        options={[5, 4]}
        selectedValues={rarities}
        onSelectedValuesChange={onRaritiesChange}
        getKey={String}
        getLabel={(value) => `${value} ★`}
        className="contents"
        disabled={disabled}
      />
      <ArchiveChipDivider />
      {/* Nine Paths: icon chips keep the whole filter row on one line. */}
      <FilterChipGroup
        options={propertyTables.paths.map((entry) => entry.id)}
        selectedValues={paths}
        onSelectedValuesChange={onPathsChange}
        getKey={(id) => id}
        getTitle={pathName}
        getLabel={() => null}
        getIcon={(id) => (
          <AssetImage
            kind="path"
            id={id}
            sourcePath={propertyTables.pathById.get(id)?.icon_path}
            alt=""
            className="h-4 w-4"
          />
        )}
        className="contents"
        disabled={disabled}
      />
    </>
  );
}

function CharacterListRow({
  character,
  selected,
  propertyTables,
  onSelect,
}: {
  character: CharacterDefinition;
  selected: boolean;
  propertyTables: PropertyCatalog;
  onSelect: () => void;
}) {
  const { locale, t } = useI18n();
  const name = characterCatalogName(character, locale, t("terms.trailblazer"));
  const combat = propertyTables.combatTypeById.get(character.combat_type_id);
  return (
    <button
      type="button"
      data-character-id={character.id}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "bg-primary/15 ring-1 ring-primary/30" : "hover:bg-accent/50"
      )}
    >
      <ItemIcon
        kind="character"
        id={character.id}
        sourcePath={character.icon_path}
        alt={name}
        rarity={character.rarity}
        size="sm"
        className="shrink-0"
        imageClassName="object-cover object-top"
        cornerAsset={
          combat
            ? {
                kind: "combat-type",
                id: combat.id,
                sourcePath: combat.icon_path,
                alt: getLocalizedValue(combat.name, locale),
              }
            : undefined
        }
      />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-sm font-medium">{name}</span>
        <BetaBadge member="characters" id={character.id} />
      </span>
    </button>
  );
}

function CharacterGridTile({
  character,
  selected,
  onSelect,
}: {
  character: CharacterDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  const { locale, t } = useI18n();
  const name = characterCatalogName(character, locale, t("terms.trailblazer"));
  return (
    <button
      type="button"
      data-character-id={character.id}
      aria-pressed={selected}
      onClick={onSelect}
      className="flex min-w-0 flex-col items-center gap-1 rounded-lg p-1 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ItemIcon
        kind="character"
        id={character.id}
        sourcePath={character.icon_path}
        alt={name}
        rarity={character.rarity}
        size="sm"
        imageClassName="object-cover object-top"
      />
      <span className="flex w-full min-w-0 items-center justify-center gap-1">
        <span className="min-w-0 truncate text-center text-xs text-foreground">
          {name}
        </span>
        <BetaBadge member="characters" id={character.id} />
      </span>
    </button>
  );
}

function CharacterDetail({
  character,
  propertyTables,
  descriptionMode,
  onDescriptionModeChange,
}: {
  character: CharacterDefinition;
  propertyTables: PropertyCatalog;
  descriptionMode: CharacterDescriptionMode;
  onDescriptionModeChange: (mode: CharacterDescriptionMode) => void;
}) {
  const { locale, t } = useI18n();
  const name = characterCatalogName(character, locale, t("terms.trailblazer"));
  return (
    <aside data-testid="character-detail">
      <Card className="bg-gradient-card">
        <CardContent className="space-y-4 px-3 py-4 md:space-y-6 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 min-[1920px]:flex-row min-[1920px]:items-start min-[1920px]:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <ItemIcon
                kind="character"
                id={character.id}
                sourcePath={character.icon_path}
                alt={name}
                rarity={character.rarity}
                size="xl"
                className="shrink-0"
                imageClassName="object-cover object-top"
              />
              <div className="min-w-0 space-y-2">
                <h2 className="text-xl font-bold md:text-2xl">{name}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <CharacterBadgeGroup
                    character={character}
                    properties={propertyTables}
                  />
                  <BetaBadge member="characters" id={character.id} />
                </div>
              </div>
            </div>
            <div className="min-[1920px]:w-[32rem] min-[1920px]:shrink-0">
              <CharacterBaseStats character={character} />
            </div>
          </div>
          <CurrencyWarText
            text={character.description}
            className="px-1 text-muted-foreground"
          />
          <CharacterExtendedDetails
            character={character}
            propertyTables={propertyTables}
            descriptionMode={descriptionMode}
            skillsAction={
              <SegmentedTabs
                size="sm"
                label={t("archive.descriptionMode")}
                value={descriptionMode}
                onValueChange={onDescriptionModeChange}
                items={[
                  { value: "short", label: t("archive.descriptionShort") },
                  { value: "full", label: t("archive.descriptionFull") },
                ]}
              />
            }
          />
          {character.currency_war.length > 0 && (
            <CharacterCurrencyWarDetails
              variants={character.currency_war}
              characterSkills={[
                ...character.skills,
                ...character.servants.flatMap((servant) => servant.skills),
              ]}
              properties={propertyTables}
              descriptionMode={descriptionMode}
            />
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
