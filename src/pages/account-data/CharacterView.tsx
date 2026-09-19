import { UsersRound } from "lucide-react";
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
  type CharacterFilters,
  characterFilterCount,
  defaultCharacterFilters,
} from "@/components/account-data/CharacterFilterPanel";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { compareCharacterPriority } from "@/domain/tier-list/utils";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import {
  characterCatalogName,
  localizedName,
  localizedSearchText,
} from "@/lib/catalogPresentation";
import { useCharacterPriorityStore } from "@/stores/useCharacterPriorityStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function CharacterView() {
  const { locale, t } = useI18n();
  const priorityAssignments = useCharacterPriorityStore(
    (state) => state.assignments
  );
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const scoreProfiles = useWorkspaceStore((state) => state.scoreProfiles);
  const buildReferences = useBuildReferences();
  const [filters, setFilters] = useState<CharacterFilters>(() => ({
    ...defaultCharacterFilters(),
    sort: "name" as const,
    direction: "ascending" as const,
  }));
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
    () =>
      (references?.properties.paths ?? []).map((path) => ({
        value: path.id,
        label: localizedName(path.name, locale, path.id),
        iconPath: path.icon_path,
      })),
    [locale, references]
  );
  const combatTypeOptions = useMemo<CharacterFilterOption[]>(
    () =>
      (references?.properties.combatTypes ?? []).map((combatType) => ({
        value: combatType.id,
        label: localizedName(combatType.name, locale, combatType.id),
        iconPath: combatType.icon_path,
      })),
    [locale, references]
  );

  const visibleCharacters = useMemo(() => {
    const normalizedQuery = filters.query.trim().toLocaleLowerCase();
    return characters
      .filter(
        (character) =>
          filters.paths.length === 0 || filters.paths.includes(character.pathId)
      )
      .filter(
        (character) =>
          filters.combatTypes.length === 0 ||
          filters.combatTypes.includes(character.combatTypeId)
      )
      .filter((character) => {
        const definition = references?.characters.byId.get(
          character.definitionId
        );
        if (
          filters.rarities.length > 0 &&
          (!definition || !filters.rarities.includes(definition.rarity))
        )
          return false;
        if (
          filters.configuredOnly &&
          !builds.some(
            (build) => build.characterDefinitionId === character.definitionId
          )
        )
          return false;
        if (!normalizedQuery) return true;
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
        if (filters.sort === "priority")
          return (
            compareCharacterPriority(
              left.definitionId,
              right.definitionId,
              priorityAssignments,
              filters.direction
            ) || leftName.localeCompare(rightName, locale)
          );
        const direction = filters.direction === "ascending" ? 1 : -1;
        const comparison =
          filters.sort === "level"
            ? left.level - right.level
            : filters.sort === "rarity"
              ? (leftDefinition?.rarity ?? 0) - (rightDefinition?.rarity ?? 0)
              : leftName.localeCompare(rightName, locale);
        return (
          comparison * direction || leftName.localeCompare(rightName, locale)
        );
      });
  }, [builds, characters, filters, locale, priorityAssignments, references, t]);

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

  const activeFilterCount = characterFilterCount(filters);
  const renderFilterPanel = (className?: string) => (
    <CharacterFilterPanel
      className={className}
      filters={filters}
      hasPriorityData={Object.keys(priorityAssignments).length > 0}
      onChange={setFilters}
      pathOptions={pathOptions}
      combatTypeOptions={combatTypeOptions}
      countLabel={t("common.count", { count: visibleCharacters.length })}
      searchPlaceholder={t("search.characters")}
      showLevelSort
    />
  );

  return (
    <PageLayout>
      <PageHeader titleKey="route.characters.title" visuallyHidden />
      {characters.length === 0 ? (
        <ScrollLayout bodyClassName="space-y-4">
          <AccountCoverageNotice account={account} />
          {account ? (
            <EmptyState messageKey="empty.characters" icon={UsersRound} />
          ) : (
            <WorkspaceStartState
              messageKey="empty.characters"
              icon={UsersRound}
            />
          )}
        </ScrollLayout>
      ) : buildReferences.loading ? (
        <ScrollLayout bodyClassName="space-y-4">
          <AccountCoverageNotice account={account} />
          <CatalogLoading />
        </ScrollLayout>
      ) : buildReferences.error || !references ? (
        <ScrollLayout bodyClassName="space-y-4">
          <AccountCoverageNotice account={account} />
          <CatalogLoadError error={buildReferences.error} />
        </ScrollLayout>
      ) : (
        <SidebarLayout
          sidebar={renderFilterPanel()}
          triggerLabel={t("characterLoadout.filters")}
          activeFilterCount={activeFilterCount}
        >
          <div className="min-w-0 space-y-4">
            <AccountCoverageNotice account={account} />
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
        </SidebarLayout>
      )}
    </PageLayout>
  );
}
