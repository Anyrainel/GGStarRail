import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { AssetImage } from "@/components/shared/AssetImage";
import { BetaBadge } from "@/components/shared/BetaBadge";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { TRAILBLAZER_TERMS } from "@/i18n/gameTerms";
import { useI18n } from "@/i18n/I18nContext";
import {
  filterArchiveItems,
  isArchiveSearchActive,
} from "@/lib/archiveFilters";
import { characterCatalogName } from "@/lib/catalogPresentation";
import { formatGameText } from "@/lib/gameText";
import { cn } from "@/lib/utils";
import {
  getLocalizedValue,
  loadCharacters,
  loadPropertyTables,
} from "@/providers/gilore/catalog";
import type {
  CharacterDefinition,
  PropertyCatalog,
} from "@/providers/gilore/types";
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
  const { locale, t } = useI18n();
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
          right.rarity - left.rarity ||
          characterCatalogName(
            left,
            locale,
            TRAILBLAZER_TERMS[locale]
          ).localeCompare(
            characterCatalogName(right, locale, TRAILBLAZER_TERMS[locale]),
            locale
          )
      ),
    [resource.data, query, searchIndex, paths, combatTypes, rarities, locale]
  );

  useEffect(() => {
    // Preserve incoming deep links until the async catalog has actually loaded.
    if (!resource.data) return;
    if (!filtered.length) setSelectedId(null);
    else if (!selectedId || !filtered.some((entry) => entry.id === selectedId))
      setSelectedId(filtered[0].id);
  }, [filtered, selectedId, resource.data]);

  if (resource.loading) return <CatalogLoading />;
  if (resource.error) return <CatalogFailure error={resource.error} />;
  if (!resource.data) return null;
  const { characters, propertyTables } = resource.data;
  const selected = selectedId ? characters.byId.get(selectedId) : undefined;
  const detail = selected ? (
    <CharacterDetail
      key={selected.id}
      character={selected}
      propertyTables={propertyTables}
      descriptionMode={descriptionMode}
      onDescriptionModeChange={setDescriptionMode}
    />
  ) : null;
  const header = (
    <ArchiveToolbar
      searchQuery={query}
      onSearchChange={setQuery}
      searchLabel={t("common.search")}
      searchPlaceholder={t("archive.search.characters")}
    >
      <FilterChipGroup
        options={propertyTables.combatTypes.map((entry) => entry.id)}
        selectedValues={combatTypes}
        onSelectedValuesChange={setCombatTypes}
        getKey={(id) => id}
        getLabel={(id) =>
          getLocalizedValue(propertyTables.combatTypeById.get(id)?.name, locale)
        }
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
        disabled={searching}
      />
      <span
        aria-hidden="true"
        className="mx-1 hidden h-5 w-px bg-border sm:block"
      />
      <FilterChipGroup
        options={[5, 4]}
        selectedValues={rarities}
        onSelectedValuesChange={setRarities}
        getKey={String}
        getLabel={(value) => `${value} ★`}
        className="contents"
        disabled={searching}
      />
      <span
        aria-hidden="true"
        className="mx-1 hidden h-5 w-px bg-border sm:block"
      />
      <FilterChipGroup
        options={propertyTables.paths.map((entry) => entry.id)}
        selectedValues={paths}
        onSelectedValuesChange={setPaths}
        getKey={(id) => id}
        getLabel={(id) =>
          getLocalizedValue(propertyTables.pathById.get(id)?.name, locale)
        }
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
        disabled={searching}
      />
    </ArchiveToolbar>
  );
  const roster = (
    <div className="min-w-0 space-y-2">
      <p className="px-2 text-xs text-muted-foreground" aria-live="polite">
        {t("archive.results", {
          shown: filtered.length,
          total: characters.values.length,
        })}
      </p>
      <section
        className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1 md:grid-cols-1 md:gap-0.5 md:p-1"
        aria-label={t("archive.characterList")}
      >
        {filtered.length === 0 ? (
          <CatalogEmpty />
        ) : (
          filtered.map((character) => (
            <CharacterListRow
              key={character.id}
              character={character}
              selected={character.id === selectedId}
              propertyTables={propertyTables}
              onSelect={() => {
                setSelectedId(character.id);
                setMobileDetailOpen(true);
              }}
            />
          ))
        )}
      </section>
    </div>
  );
  return (
    <SidebarDetailLayout
      className="h-full min-h-0"
      header={header}
      sidebar={roster}
      mobileGrid={roster}
      hasSelection={mobileDetailOpen && Boolean(selected)}
      onBack={() => setMobileDetailOpen(false)}
      backLabel={t("archive.backToCharacters")}
      detailLabel={t("archive.characterDetails")}
      sidebarWidth="w-[240px] xl:w-[280px]"
    >
      {detail}
    </SidebarDetailLayout>
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
  onSelect: (trigger: HTMLButtonElement) => void;
}) {
  const { locale, t } = useI18n();
  const name = characterCatalogName(character, locale, t("terms.trailblazer"));
  const path = propertyTables.pathById.get(character.path_id);
  const combat = propertyTables.combatTypeById.get(character.combat_type_id);
  return (
    <button
      type="button"
      data-character-id={character.id}
      aria-pressed={selected}
      onClick={(event) => onSelect(event.currentTarget)}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:w-full md:flex-row md:gap-2",
        selected ? "bg-primary/15 ring-1 ring-primary/30" : "hover:bg-accent/60"
      )}
    >
      <ItemIcon
        kind="character"
        id={character.id}
        sourcePath={character.icon_path}
        alt={name}
        rarity={character.rarity}
        size="sm"
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
      <span className="min-w-0 text-center md:flex-1 md:text-left">
        <span className="block w-full truncate text-xs font-medium md:text-sm">
          {name}
        </span>
        <span className="hidden truncate text-xs text-muted-foreground md:block">
          {getLocalizedValue(path?.name, locale)} ·{" "}
          {getLocalizedValue(combat?.name, locale)}
        </span>
      </span>
      <BetaBadge member="characters" id={character.id} />
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
        <CardContent className="space-y-5 px-3 py-4 md:space-y-6 md:px-6 md:py-6">
          <div className="flex items-center gap-4">
            <ItemIcon
              kind="character"
              id={character.id}
              sourcePath={character.icon_path}
              alt={name}
              rarity={character.rarity}
              size="xl"
              imageClassName="object-cover object-top"
            />
            <div className="min-w-0 space-y-2">
              <h2 className="text-xl font-bold md:text-2xl">{name}</h2>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {getLocalizedValue(
                    propertyTables.pathById.get(character.path_id)?.name,
                    locale
                  )}
                </Badge>
                <Badge variant="outline">
                  {getLocalizedValue(
                    propertyTables.combatTypeById.get(character.combat_type_id)
                      ?.name,
                    locale
                  )}
                </Badge>
                <BetaBadge member="characters" id={character.id} />
              </div>
            </div>
          </div>
          <CurrencyWarText
            text={character.description}
            className="text-muted-foreground"
          />
          <CharacterBaseStats character={character} />
          <fieldset
            className="flex flex-wrap items-center gap-2"
            aria-label={t("archive.descriptionMode")}
          >
            <legend className="sr-only">{t("archive.descriptionMode")}</legend>
            <span className="mr-auto text-sm font-medium">
              {t("archive.descriptionMode")}
            </span>
            <div className="flex rounded-lg border border-border bg-secondary/40 p-0.5">
              <Button
                size="sm"
                variant={descriptionMode === "short" ? "default" : "ghost"}
                aria-pressed={descriptionMode === "short"}
                onClick={() => onDescriptionModeChange("short")}
              >
                {t("archive.descriptionShort")}
              </Button>
              <Button
                size="sm"
                variant={descriptionMode === "full" ? "default" : "ghost"}
                aria-pressed={descriptionMode === "full"}
                onClick={() => onDescriptionModeChange("full")}
              >
                {t("archive.descriptionFull")}
              </Button>
            </div>
          </fieldset>
          <CharacterExtendedDetails
            character={character}
            propertyTables={propertyTables}
            descriptionMode={descriptionMode}
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
