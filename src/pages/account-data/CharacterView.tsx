import { SlidersHorizontal, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { AccountCoverageNotice } from "@/components/account/AccountCoverageNotice";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { WorkspaceStartState } from "@/components/account/WorkspaceStartState";
import {
  type CardLayout,
  CharacterCard,
} from "@/components/account-data/CharacterCard";
import {
  type CharacterFilterOption,
  CharacterFilterPanel,
} from "@/components/account-data/CharacterFilterPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import {
  characterCatalogName,
  localizedName,
  localizedSearchText,
} from "@/lib/catalogPresentation";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function CharacterView() {
  const { locale, t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const scoreProfiles = useWorkspaceStore((state) => state.scoreProfiles);
  const buildReferences = useBuildReferences();
  const [query, setQuery] = useState("");
  const [pathId, setPathId] = useState("all");
  const [combatTypeId, setCombatTypeId] = useState("all");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isVeryNarrow = useMediaQuery("(max-width: 560px)");
  const isTwoColumnCompact = useMediaQuery(
    "(min-width: 1536px) and (max-width: 2047px)"
  );
  const cardLayout = useMemo<CardLayout>(
    () => ({
      isMobile,
      isVeryNarrow,
      isRelicCompact: isVeryNarrow || isTwoColumnCompact,
    }),
    [isMobile, isTwoColumnCompact, isVeryNarrow]
  );

  const characters = account?.characters ?? [];
  const references = buildReferences.data;

  const pathOptions = useMemo<CharacterFilterOption[]>(
    () => [
      { value: "all", label: t("filter.allPaths") },
      ...Array.from(new Set(characters.map((character) => character.pathId)))
        .map((id) => ({
          value: id,
          label: localizedName(
            references?.properties.pathById.get(id)?.name,
            locale,
            id
          ),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    ],
    [characters, locale, references, t]
  );

  const combatTypeOptions = useMemo<CharacterFilterOption[]>(
    () => [
      { value: "all", label: t("filter.allCombatTypes") },
      ...Array.from(
        new Set(characters.map((character) => character.combatTypeId))
      )
        .map((id) => ({
          value: id,
          label: localizedName(
            references?.properties.combatTypeById.get(id)?.name,
            locale,
            id
          ),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    ],
    [characters, locale, references, t]
  );

  const visibleCharacters = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return characters
      .filter((character) => pathId === "all" || character.pathId === pathId)
      .filter(
        (character) =>
          combatTypeId === "all" || character.combatTypeId === combatTypeId
      )
      .filter((character) => {
        if (!normalizedQuery) return true;
        const definition = references?.characters.byId.get(
          character.definitionId
        );
        return localizedSearchText(
          definition?.name,
          character.definitionId
        ).includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftDefinition = references?.characters.byId.get(
          left.definitionId
        );
        const rightDefinition = references?.characters.byId.get(
          right.definitionId
        );
        const leftName = leftDefinition
          ? characterCatalogName(leftDefinition, locale, t("terms.trailblazer"))
          : left.definitionId;
        const rightName = rightDefinition
          ? characterCatalogName(
              rightDefinition,
              locale,
              t("terms.trailblazer")
            )
          : right.definitionId;
        return leftName.localeCompare(rightName, locale);
      });
  }, [characters, combatTypeId, locale, pathId, query, references, t]);

  const lightConeByKey = useMemo(
    () =>
      new Map(
        account?.lightCones.map((lightCone) => [lightCone.key, lightCone])
      ),
    [account]
  );
  const relicByKey = useMemo(
    () => new Map(account?.relics.map((relic) => [relic.key, relic])),
    [account]
  );
  const profileById = useMemo(
    () => new Map(scoreProfiles.map((profile) => [profile.id, profile])),
    [scoreProfiles]
  );
  const buildByCharacterId = useMemo(() => {
    const result = new Map<string, (typeof builds)[number]>();
    for (const build of builds) {
      if (
        !result.has(build.characterDefinitionId) &&
        profileById.has(build.scoreProfileId)
      ) {
        result.set(build.characterDefinitionId, build);
      }
    }
    return result;
  }, [builds, profileById]);

  const clearFilters = () => {
    setQuery("");
    setPathId("all");
    setCombatTypeId("all");
  };
  const activeFilterCount =
    Number(query.trim().length > 0) +
    Number(pathId !== "all") +
    Number(combatTypeId !== "all");

  const renderFilterPanel = (className?: string) => (
    <CharacterFilterPanel
      className={className}
      query={query}
      pathId={pathId}
      combatTypeId={combatTypeId}
      pathOptions={pathOptions}
      combatTypeOptions={combatTypeOptions}
      countLabel={t("common.count", {
        count: visibleCharacters.length,
      })}
      labels={{
        filters: t("characterLoadout.filters"),
        search: t("common.search"),
        searchPlaceholder: t("search.characters"),
        path: t("filter.path"),
        combatType: t("filter.combatType"),
        clear: t("characterLoadout.clearFilters"),
      }}
      onQueryChange={setQuery}
      onPathChange={setPathId}
      onCombatTypeChange={setCombatTypeId}
      onClear={clearFilters}
    />
  );

  return (
    <>
      <PageHeader
        titleKey="route.characters.title"
        descriptionKey="route.characters.description"
        visuallyHidden
      />
      <AccountCoverageNotice account={account} />
      {characters.length === 0 ? (
        account ? (
          <EmptyState messageKey="empty.characters" icon={UsersRound} />
        ) : (
          <WorkspaceStartState
            messageKey="empty.characters"
            icon={UsersRound}
          />
        )
      ) : buildReferences.loading ? (
        <CatalogLoading />
      ) : buildReferences.error || !references ? (
        <CatalogLoadError error={buildReferences.error} />
      ) : (
        <div className="min-w-0 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-2 xl:grid-cols-[17.5rem_minmax(0,1fr)] 2xl:grid-cols-[15rem_minmax(0,1fr)] 3xl:grid-cols-[17.5rem_minmax(0,1fr)] 3xl:gap-3">
          <div className="mb-3 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  {t("characterLoadout.filters")}
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground tabular-nums">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                closeLabel={t("common.close")}
                className="overflow-y-auto"
              >
                <SheetTitle>{t("characterLoadout.filters")}</SheetTitle>
                <SheetDescription>
                  {t("route.characters.description")}
                </SheetDescription>
                {renderFilterPanel(
                  "mt-4 border-0 bg-transparent p-0 lg:static"
                )}
              </SheetContent>
            </Sheet>
          </div>

          <div className="hidden min-w-0 lg:block">{renderFilterPanel()}</div>
          <div className="min-w-0">
            {visibleCharacters.length === 0 ? (
              <EmptyState messageKey="empty.filtered" icon={UsersRound} />
            ) : (
              <section
                className="grid min-w-0 items-stretch gap-3 2xl:grid-cols-[repeat(2,minmax(32rem,1fr))]"
                data-character-grid
              >
                {visibleCharacters.map((character) => {
                  const build = buildByCharacterId.get(character.definitionId);
                  return (
                    <CharacterCard
                      key={character.key}
                      character={character}
                      lightCone={
                        character.lightConeKey
                          ? lightConeByKey.get(character.lightConeKey)
                          : undefined
                      }
                      relics={character.relicKeys.flatMap((key) => {
                        const relic = relicByKey.get(key);
                        return relic ? [relic] : [];
                      })}
                      build={build}
                      profile={
                        build
                          ? profileById.get(build.scoreProfileId)
                          : undefined
                      }
                      references={references}
                      locale={locale}
                      layout={cardLayout}
                    />
                  );
                })}
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
