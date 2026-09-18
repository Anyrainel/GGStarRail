import { SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import {
  CharacterFilterPanel,
  characterFilterCount,
  defaultCharacterFilters,
} from "@/components/account-data/CharacterFilterPanel";
import { CharacterBuildCard } from "@/components/artifact-builds/CharacterBuildCard";
import { BuildWorkspaceActions } from "@/components/builds/BuildWorkspaceActions";
import { ConfirmDialog } from "@/components/builds/ConfirmDialog";
import { StatusBanner } from "@/components/builds/StatusBanner";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import type { BuildConfiguration } from "@/domain/build/schemas";
import { compareCharacterPriority } from "@/domain/tier-list/utils";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import {
  characterCatalogPresentation,
  localizedName,
  localizedSearchText,
} from "@/lib/catalogPresentation";
import { useCharacterPriorityStore } from "@/stores/useCharacterPriorityStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function CharacterBuildView() {
  const { locale, t } = useI18n();
  const priorityAssignments = useCharacterPriorityStore(
    (state) => state.assignments
  );
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const scoreProfiles = useWorkspaceStore((state) => state.scoreProfiles);
  const upsertBuild = useWorkspaceStore((state) => state.upsertBuild);
  const removeBuild = useWorkspaceStore((state) => state.removeBuild);
  const upsertScoreProfile = useWorkspaceStore(
    (state) => state.upsertScoreProfile
  );
  const { data, error, loading } = useBuildReferences();
  const [filters, setFilters] = useState(defaultCharacterFilters);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BuildConfiguration | null>(
    null
  );

  useEffect(() => {
    if (!account && filters.ownedOnly)
      setFilters((current) => ({ ...current, ownedOnly: false }));
  }, [account, filters.ownedOnly]);

  const ownedByDefinition = useMemo(
    () =>
      new Map(
        (account?.characters ?? []).map((character) => [
          character.definitionId,
          character,
        ])
      ),
    [account]
  );
  const buildsByCharacter = useMemo(() => {
    const result = new Map<string, BuildConfiguration[]>();
    for (const build of builds) {
      const entries = result.get(build.characterDefinitionId) ?? [];
      entries.push(build);
      result.set(build.characterDefinitionId, entries);
    }
    return result;
  }, [builds]);
  const profilesById = useMemo(
    () => new Map(scoreProfiles.map((profile) => [profile.id, profile])),
    [scoreProfiles]
  );

  const visibleCharacters = useMemo(() => {
    if (!data) return [];
    const needle = filters.query.trim().toLocaleLowerCase();
    return [...data.characters.values]
      .filter((character) => {
        if (filters.ownedOnly && !ownedByDefinition.has(character.id))
          return false;
        if (
          filters.paths.length > 0 &&
          !filters.paths.includes(character.path_id)
        )
          return false;
        if (
          filters.rarities.length > 0 &&
          !filters.rarities.includes(character.rarity)
        )
          return false;
        if (filters.configuredOnly && !buildsByCharacter.has(character.id))
          return false;
        if (
          filters.combatTypes.length > 0 &&
          !filters.combatTypes.includes(character.combat_type_id)
        ) {
          return false;
        }
        const presentation = characterCatalogPresentation(
          character,
          data.properties,
          locale,
          t("terms.trailblazer")
        );
        return (
          !needle ||
          `${localizedSearchText(character.name, character.id)} ${presentation.label.toLocaleLowerCase()}`.includes(
            needle
          )
        );
      })
      .sort((left, right) => {
        const leftName = characterCatalogPresentation(
          left,
          data.properties,
          locale,
          t("terms.trailblazer")
        ).name;
        const rightName = characterCatalogPresentation(
          right,
          data.properties,
          locale,
          t("terms.trailblazer")
        ).name;
        if (filters.sort === "priority")
          return (
            compareCharacterPriority(
              left.id,
              right.id,
              priorityAssignments,
              filters.direction
            ) || leftName.localeCompare(rightName, locale)
          );
        const comparison =
          filters.sort === "rarity"
            ? left.rarity - right.rarity
            : leftName.localeCompare(rightName, locale);
        return (
          comparison * (filters.direction === "ascending" ? 1 : -1) ||
          leftName.localeCompare(rightName, locale)
        );
      });
  }, [
    buildsByCharacter,
    filters,
    data,
    locale,
    ownedByDefinition,
    priorityAssignments,
    t,
  ]);

  function addBuild(
    characterId: string,
    setPlan: Pick<BuildConfiguration, "cavern" | "planarSetId">
  ) {
    if (!data) return;
    const definition = data.characters.byId.get(characterId);
    if (!definition) return;
    const characterName = characterCatalogPresentation(
      definition,
      data.properties,
      locale,
      t("terms.trailblazer")
    ).name;
    try {
      const profile = createCharacterScoreProfile(
        definition,
        data.progression,
        t("build.defaultProfileName", { character: characterName })
      );
      const build = createCharacterBuild(
        definition,
        setPlan,
        data.properties,
        data.progression,
        profile.id,
        t("build.defaultBuildName", { character: characterName })
      );
      upsertScoreProfile(profile);
      upsertBuild(build);
      setCreateError(null);
    } catch {
      setCreateError(t("build.createError"));
    }
  }

  const activeFilterCount = characterFilterCount(filters);
  const renderFilterPanel = (
    references: NonNullable<typeof data>,
    className?: string
  ) => (
    <CharacterFilterPanel
      className={className}
      filters={filters}
      hasPriorityData={Object.keys(priorityAssignments).length > 0}
      onChange={setFilters}
      pathOptions={references.properties.paths.map((path) => ({
        value: path.id,
        label: localizedName(path.name, locale, path.id),
        iconPath: path.icon_path,
      }))}
      combatTypeOptions={references.properties.combatTypes.map(
        (combatType) => ({
          value: combatType.id,
          label: localizedName(combatType.name, locale, combatType.id),
          iconPath: combatType.icon_path,
        })
      )}
      countLabel={t("build.catalogCount", {
        shown: visibleCharacters.length,
        total: references.characters.values.length,
      })}
      searchPlaceholder={t("build.searchPlaceholder")}
      showOwnedOnly
      hasAccount={account !== null}
    />
  );

  return (
    <>
      <PageHeader titleKey="route.builds.title" visuallyHidden />
      <BuildWorkspaceActions references={data} />
      {createError && <StatusBanner message={createError} tone="error" />}
      {loading ? (
        <CatalogLoading />
      ) : error || !data ? (
        <CatalogLoadError error={error} />
      ) : (
        <SidebarLayout
          sidebar={renderFilterPanel(data)}
          triggerLabel={t("characterLoadout.filters")}
          activeFilterCount={activeFilterCount}
        >
          <div className="min-w-0 space-y-4">
            {visibleCharacters.map((character) => {
              return (
                <CharacterBuildCard
                  key={character.id}
                  character={character}
                  builds={buildsByCharacter.get(character.id) ?? []}
                  profiles={profilesById}
                  references={data}
                  onAddBuild={(setPlan) => addBuild(character.id, setPlan)}
                  onBuildChange={upsertBuild}
                  onProfileChange={upsertScoreProfile}
                  onDeleteBuild={setPendingDelete}
                />
              );
            })}
            {visibleCharacters.length === 0 && (
              <EmptyState
                messageKey="build.noCatalogMatches"
                icon={SlidersHorizontal}
              />
            )}
          </div>
        </SidebarLayout>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("build.delete")}
        description={t("build.deleteConfirm", {
          name: pendingDelete?.name ?? "",
        })}
        confirmLabel={t("build.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={() => {
          if (!pendingDelete) return;
          removeBuild(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
