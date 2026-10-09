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
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { ItemPicker } from "@/components/shared/ItemPicker";
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
  catalogPickerItems,
  rarityPickerFilter,
} from "@/lib/catalogPickerItems";
import {
  characterCatalogPresentation,
  localizedName,
  localizedSearchText,
} from "@/lib/catalogPresentation";
import { compareReleaseVersionsDescending } from "@/lib/releaseVersion";
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
  const characterItems = useMemo(
    () =>
      data
        ? catalogPickerItems("character", data, locale, t("terms.trailblazer"))
        : [],
    [data, locale, t]
  );
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
        const comparison = -compareReleaseVersionsDescending(
          left.release_version,
          right.release_version
        );
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
    category: BuildConfiguration["category"]
  ) {
    if (!data) return;
    const definition = data.characters.byId.get(characterId);
    if (!definition) return;
    const previous = [...builds]
      .reverse()
      .find(
        (build) =>
          build.characterDefinitionId === characterId &&
          build.category === category
      );
    const setId = data.relicSets.values.find(
      (set) =>
        set.kind ===
        (category === "cavern" ? "cavern_relic" : "planar_ornament")
    )?.id;
    if (!setId) throw new Error("Build creation requires a set catalog");
    const setPlan =
      category === "cavern"
        ? {
            category,
            cavern:
              previous?.category === "cavern"
                ? previous.cavern
                : { mode: "four-piece" as const, setId },
          }
        : {
            category,
            planarSetId:
              previous?.category === "planar" ? previous.planarSetId : setId,
          };
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
    <PageLayout>
      <PageHeader titleKey="route.builds.title" visuallyHidden />
      <div className="container max-h-[30%] shrink-0 overflow-y-auto">
        <BuildWorkspaceActions references={data} />
      </div>
      {loading ? (
        <ScrollLayout>
          <CatalogLoading />
        </ScrollLayout>
      ) : error || !data ? (
        <ScrollLayout>
          <CatalogLoadError error={error} />
        </ScrollLayout>
      ) : (
        <SidebarLayout
          sidebar={renderFilterPanel(data)}
          triggerLabel={t("characterLoadout.filters")}
          activeFilterCount={activeFilterCount}
        >
          <div className="min-w-0 space-y-4">
            {createError && <StatusBanner message={createError} tone="error" />}
            <div className="flex items-center gap-2">
              <ItemPicker
                kind="character"
                label={t("build.selectCharacter")}
                value={
                  characterItems.find(
                    (item) =>
                      item.name === filters.query &&
                      filters.paths.includes(
                        data.characters.byId.get(item.id)!.path_id
                      )
                  )?.id ?? null
                }
                items={characterItems}
                compact
                filters={[
                  rarityPickerFilter(characterItems, t("filter.rarity")),
                  {
                    id: "path",
                    label: t("filter.path"),
                    options: data.properties.paths.map((path) => ({
                      id: path.id,
                      label: localizedName(path.name, locale, path.id),
                    })),
                  },
                ]}
                onChange={(id) => {
                  const character = data.characters.byId.get(id)!;
                  setFilters({
                    ...defaultCharacterFilters(),
                    query: characterItems.find((item) => item.id === id)!.name,
                    paths: [character.path_id],
                  });
                }}
                onClear={() => setFilters(defaultCharacterFilters())}
              />
              <span className="text-sm font-medium">
                {t("build.selectCharacter")}
              </span>
            </div>
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
    </PageLayout>
  );
}
