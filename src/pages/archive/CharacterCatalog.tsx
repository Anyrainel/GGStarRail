import { type RefObject, useEffect, useMemo, useState } from "react";
import { AssetImage } from "@/components/shared/AssetImage";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useCatalogResource } from "@/hooks/useCatalogResource";
import { useMobileDetailFocus } from "@/hooks/useMobileDetailFocus";
import { TRAILBLAZER_TERMS } from "@/i18n/gameTerms";
import { useI18n } from "@/i18n/I18nContext";
import { formatCharacterDisplayName, formatGameText } from "@/lib/gameText";
import {
  getLocalizedValue,
  isCharacterDefinitionV1_1,
  isProgressionTablesV1_1,
  loadCharacters,
  loadProgression,
  loadPropertyTables,
} from "@/providers/gilore/catalog";
import type {
  CharacterDefinition,
  ProgressionTables,
  PropertyCatalog,
  ReferenceLocale,
} from "@/providers/gilore/types";
import {
  CatalogEmpty,
  CatalogFailure,
  CatalogLoading,
  CatalogSearch,
  CatalogSelect,
} from "./CatalogControls";
import {
  CharacterExtendedDetails,
  characterExtendedSearchText,
} from "./CharacterExtendedDetails";
import {
  createProgressionItemIndex,
  MaterialCosts,
} from "./ProgressionDetails";

async function loadCharacterArchiveData() {
  const [characters, propertyTables, progression] = await Promise.all([
    loadCharacters(),
    loadPropertyTables(),
    loadProgression(),
  ]);
  return { characters, propertyTables, progression };
}

function searchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function characterDisplayName(
  character: CharacterDefinition,
  locale: ReferenceLocale,
  trailblazerFallback: string
): string {
  return formatGameText(
    formatCharacterDisplayName(
      character.id,
      getLocalizedValue(character.name, locale),
      trailblazerFallback
    ),
    [],
    trailblazerFallback
  );
}

export function CharacterCatalog() {
  const { locale, t } = useI18n();
  const trailblazerFallback = t("terms.trailblazer");
  const resource = useCatalogResource(loadCharacterArchiveData);
  const [query, setQuery] = useState("");
  const [pathId, setPathId] = useState("all");
  const [combatTypeId, setCombatTypeId] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { detailRef, requestMobileDetailFocus } =
    useMobileDetailFocus<HTMLElement>();

  const searchIndex = useMemo(() => {
    if (!resource.data) return new Map<string, string>();
    return new Map(
      resource.data.characters.values.map((character) => {
        const localizedValues = (["en", "zh-CN"] as const).flatMap(
          (searchLocale) => [
            characterDisplayName(
              character,
              searchLocale,
              TRAILBLAZER_TERMS[searchLocale]
            ),
            character.description
              ? formatGameText(
                  getLocalizedValue(character.description, searchLocale),
                  [],
                  TRAILBLAZER_TERMS[searchLocale]
                )
              : "",
          ]
        );
        const extended = isCharacterDefinitionV1_1(character)
          ? formatGameText(
              characterExtendedSearchText(character),
              [],
              `${TRAILBLAZER_TERMS.en} ${TRAILBLAZER_TERMS["zh-CN"]}`
            )
          : "";
        return [
          character.id,
          searchText(
            `${localizedValues.join(" ")} ${character.id} ${extended}`
          ),
        ];
      })
    );
  }, [resource.data]);

  const filtered = useMemo(() => {
    if (!resource.data) return [];
    const needle = searchText(query);
    return [...resource.data.characters.values]
      .filter((character) => {
        if (pathId !== "all" && character.path_id !== pathId) return false;
        if (combatTypeId !== "all" && character.combat_type_id !== combatTypeId)
          return false;
        if (rarity !== "all" && character.rarity !== Number(rarity))
          return false;
        if (!needle) return true;
        return searchIndex.get(character.id)?.includes(needle) ?? false;
      })
      .sort((left, right) => {
        const rarityOrder = right.rarity - left.rarity;
        if (rarityOrder !== 0) return rarityOrder;
        return characterDisplayName(
          left,
          locale,
          trailblazerFallback
        ).localeCompare(
          characterDisplayName(right, locale, trailblazerFallback),
          locale
        );
      });
  }, [
    combatTypeId,
    locale,
    pathId,
    query,
    rarity,
    resource.data,
    searchIndex,
    trailblazerFallback,
  ]);

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

  const { characters, propertyTables, progression } = resource.data;
  const selected = selectedId ? characters.byId.get(selectedId) : undefined;
  const selectedPath = selected
    ? propertyTables.pathById.get(selected.path_id)
    : undefined;
  const selectedCombatType = selected
    ? propertyTables.combatTypeById.get(selected.combat_type_id)
    : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/55 p-3 xl:flex-row xl:items-end">
        <CatalogSearch
          value={query}
          onChange={setQuery}
          placeholderKey="archive.search.characters"
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
            labelKey="filter.combatType"
            value={combatTypeId}
            onChange={setCombatTypeId}
          >
            <option value="all">{t("filter.allCombatTypes")}</option>
            {propertyTables.combatTypes.map((combatType) => (
              <option key={combatType.id} value={combatType.id}>
                {formatGameText(getLocalizedValue(combatType.name, locale))}
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
          </CatalogSelect>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("archive.results", {
          shown: filtered.length,
          total: characters.values.length,
        })}
      </p>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <section
          className="order-2 grid gap-3 sm:grid-cols-2 lg:order-1 xl:grid-cols-3"
          aria-label={t("archive.characterList")}
        >
          {filtered.length === 0 ? (
            <CatalogEmpty />
          ) : (
            filtered.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                selected={character.id === selected?.id}
                pathName={formatGameText(
                  getLocalizedValue(
                    propertyTables.pathById.get(character.path_id)?.name,
                    locale
                  ) ?? character.path_id
                )}
                combatTypeName={formatGameText(
                  getLocalizedValue(
                    propertyTables.combatTypeById.get(character.combat_type_id)
                      ?.name,
                    locale
                  ) ?? character.combat_type_id
                )}
                onSelect={() => {
                  setSelectedId(character.id);
                  requestMobileDetailFocus();
                }}
              />
            ))
          )}
        </section>
        {selected && (
          <CharacterDetail
            panelRef={detailRef}
            character={selected}
            pathName={
              selectedPath
                ? formatGameText(getLocalizedValue(selectedPath.name, locale))
                : selected.path_id
            }
            combatTypeName={
              selectedCombatType
                ? formatGameText(
                    getLocalizedValue(selectedCombatType.name, locale)
                  )
                : selected.combat_type_id
            }
            scoringWeights={
              progression.relic_scoring.main_affix_character_weights.find(
                (entry) => entry.character_id === selected.id
              )?.weights
            }
            progression={progression}
            propertyTables={propertyTables}
          />
        )}
      </div>
    </div>
  );
}

function CharacterCard({
  character,
  selected,
  pathName,
  combatTypeName,
  onSelect,
}: {
  character: CharacterDefinition;
  selected: boolean;
  pathName: string;
  combatTypeName: string;
  onSelect: () => void;
}) {
  const { locale, t } = useI18n();
  const name = characterDisplayName(character, locale, t("terms.trailblazer"));
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="group overflow-hidden rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        className={
          selected
            ? "h-full border-primary/60 bg-primary/10"
            : "h-full transition-colors group-hover:border-primary/35 group-hover:bg-secondary/45"
        }
      >
        <CardContent className="flex items-center gap-3 p-3">
          <AssetImage
            kind="character"
            id={character.id}
            sourcePath={character.icon_path}
            alt={name}
            className="h-20 w-20 shrink-0 rounded-lg bg-background/60 object-cover object-top"
          />
          <span className="min-w-0 space-y-2">
            <span className="block truncate font-semibold">{name}</span>
            <span className="flex flex-wrap gap-1.5">
              <Badge>{character.rarity} ★</Badge>
              <Badge variant="secondary">{pathName}</Badge>
              <Badge variant="outline">{combatTypeName}</Badge>
            </span>
            <code className="block text-[11px] text-muted-foreground">
              {character.id}
            </code>
          </span>
        </CardContent>
      </Card>
    </button>
  );
}

function CommonCharacterSkills({
  character,
}: {
  character: CharacterDefinition;
}) {
  const { locale, t } = useI18n();
  const trailblazer = t("terms.trailblazer");
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">{t("archive.skills")}</h3>
      {character.skills.map((skill) => {
        const firstLevel = skill.levels[0];
        return (
          <details
            key={skill.id}
            className="rounded-lg border border-border bg-background/45 p-3"
          >
            <summary className="cursor-pointer font-medium">
              {formatGameText(
                getLocalizedValue(skill.name, locale),
                [],
                trailblazer
              )}
              <span className="ml-2 text-xs text-muted-foreground">
                {skill.attack_type}
              </span>
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {formatGameText(
                getLocalizedValue(skill.description, locale),
                firstLevel?.parameters,
                trailblazer
              )}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("archive.skillLevels", { value: skill.levels.length })}
            </p>
          </details>
        );
      })}
    </section>
  );
}

function CharacterDetail({
  panelRef,
  character,
  pathName,
  combatTypeName,
  scoringWeights,
  progression,
  propertyTables,
}: {
  panelRef: RefObject<HTMLElement | null>;
  character: CharacterDefinition;
  pathName: string;
  combatTypeName: string;
  scoringWeights: Readonly<Record<string, number>> | undefined;
  progression: ProgressionTables;
  propertyTables: PropertyCatalog;
}) {
  const { locale, t } = useI18n();
  const name = characterDisplayName(character, locale, t("terms.trailblazer"));
  const description = character.description
    ? formatGameText(
        getLocalizedValue(character.description, locale),
        [],
        t("terms.trailblazer")
      )
    : t("archive.sourceValueMissing");
  const provenance = character.name[locale].provenance;
  const additiveCharacter = isCharacterDefinitionV1_1(character)
    ? character
    : null;
  const additiveProgression = isProgressionTablesV1_1(progression)
    ? progression
    : null;
  const additivePropertyTables =
    propertyTables.schemaVersion === "1.1.0" ? propertyTables : null;
  const itemById = additiveProgression
    ? createProgressionItemIndex(additiveProgression.items)
    : null;
  const promotionCostRows = character.promotions.reduce(
    (total, promotion) => total + promotion.costs.length,
    0
  );
  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      data-testid="character-detail"
      className="order-1 scroll-mt-4 space-y-5 rounded-xl border border-border bg-card/75 p-4 outline-none lg:order-2 lg:sticky lg:top-0"
    >
      <div className="flex gap-4">
        <AssetImage
          kind="character"
          id={character.id}
          sourcePath={character.icon_path}
          alt={name}
          className="h-28 w-28 shrink-0 rounded-xl bg-background/60 object-cover object-top"
        />
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {character.rarity} ★
          </p>
          <h2 className="text-xl font-semibold">{name}</h2>
          <code className="text-xs text-muted-foreground">{character.id}</code>
          <div className="flex flex-wrap gap-2">
            <Badge>{pathName}</Badge>
            <Badge variant="secondary">{combatTypeName}</Badge>
            <Badge variant="outline">
              {t("archive.energy", { value: character.max_energy })}
            </Badge>
          </div>
        </div>
      </div>
      <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
        {description}
      </p>

      {additiveCharacter && additiveProgression && additivePropertyTables ? (
        <CharacterExtendedDetails
          character={additiveCharacter}
          progressionItems={additiveProgression.items}
          propertyTables={additivePropertyTables}
        />
      ) : (
        <>
          <CommonCharacterSkills character={character} />
          <p className="rounded-lg border border-border bg-background/45 p-3 text-xs leading-5 text-muted-foreground">
            {t("archive.additiveUnavailable")}
          </p>
        </>
      )}

      <details className="rounded-lg border border-border bg-background/45 p-3">
        <summary className="cursor-pointer font-semibold">
          {itemById
            ? t("archive.promotionsWithCosts", {
                promotions: character.promotions.length,
                costs: promotionCostRows,
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
              {character.promotions.map((promotion) => (
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
            {character.promotions.map((promotion) => (
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

      {scoringWeights && (
        <details className="rounded-lg border border-border bg-background/45 p-3">
          <summary className="cursor-pointer font-semibold">
            {t("archive.sourceScoring")}
          </summary>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {t("archive.sourceScoringHint")}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {Object.entries(scoringWeights).map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between gap-2 rounded-md bg-secondary/55 px-2 py-1.5"
              >
                <dt className="truncate text-muted-foreground">{key}</dt>
                <dd className="font-mono">{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      <div className="rounded-lg border border-border bg-background/45 p-3 text-xs text-muted-foreground">
        <p>{t("archive.provenance.primary")}</p>
        <code className="mt-1 block break-all">
          {provenance.source_revision}
        </code>
        <p className="mt-2 break-all">{provenance.source_path}</p>
      </div>
    </aside>
  );
}
