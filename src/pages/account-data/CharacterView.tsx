import { UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { AccountCoverageNotice } from "@/components/account/AccountCoverageNotice";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { WorkspaceStartState } from "@/components/account/WorkspaceStartState";
import { CharacterCard } from "@/components/account-data/CharacterCard";
import {
  type CharacterFilterOption,
  CharacterFilterPanel,
} from "@/components/account-data/CharacterFilterPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
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
        <div className="grid min-w-0 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <CharacterFilterPanel
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
          <div className="min-w-0">
            {visibleCharacters.length === 0 ? (
              <EmptyState messageKey="empty.filtered" icon={UsersRound} />
            ) : (
              <section className="grid min-w-0 gap-4">
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
