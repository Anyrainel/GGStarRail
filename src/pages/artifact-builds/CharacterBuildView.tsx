import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import { CharacterBuildCard } from "@/components/artifact-builds/CharacterBuildCard";
import { SelectField, ToggleField } from "@/components/builds/BuildControls";
import { BuildWorkspaceActions } from "@/components/builds/BuildWorkspaceActions";
import { ConfirmDialog } from "@/components/builds/ConfirmDialog";
import { StatusBanner } from "@/components/builds/StatusBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import type { BuildConfiguration } from "@/domain/build/schemas";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import {
  characterCatalogPresentation,
  localizedName,
  localizedSearchText,
} from "@/lib/catalogPresentation";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export default function CharacterBuildView() {
  const { locale, t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const scoreProfiles = useWorkspaceStore((state) => state.scoreProfiles);
  const upsertBuild = useWorkspaceStore((state) => state.upsertBuild);
  const removeBuild = useWorkspaceStore((state) => state.removeBuild);
  const upsertScoreProfile = useWorkspaceStore(
    (state) => state.upsertScoreProfile
  );
  const { data, error, loading } = useBuildReferences();
  const [query, setQuery] = useState("");
  const [pathId, setPathId] = useState("all");
  const [combatTypeId, setCombatTypeId] = useState("all");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BuildConfiguration | null>(
    null
  );

  useEffect(() => {
    if (!account && ownedOnly) setOwnedOnly(false);
  }, [account, ownedOnly]);

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
  const lightConeByKey = useMemo(
    () =>
      new Map(
        (account?.lightCones ?? []).map((lightCone) => [
          lightCone.key,
          lightCone,
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
    const needle = query.trim().toLocaleLowerCase();
    return [...data.characters.values]
      .filter((character) => {
        if (ownedOnly && !ownedByDefinition.has(character.id)) return false;
        if (pathId !== "all" && character.path_id !== pathId) return false;
        if (
          combatTypeId !== "all" &&
          character.combat_type_id !== combatTypeId
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
        const leftOwned = Number(ownedByDefinition.has(left.id));
        const rightOwned = Number(ownedByDefinition.has(right.id));
        const leftConfigured = Number(buildsByCharacter.has(left.id));
        const rightConfigured = Number(buildsByCharacter.has(right.id));
        return (
          rightOwned - leftOwned ||
          rightConfigured - leftConfigured ||
          right.rarity - left.rarity ||
          characterCatalogPresentation(
            left,
            data.properties,
            locale,
            t("terms.trailblazer")
          ).name.localeCompare(
            characterCatalogPresentation(
              right,
              data.properties,
              locale,
              t("terms.trailblazer")
            ).name,
            locale
          )
        );
      });
  }, [
    buildsByCharacter,
    combatTypeId,
    data,
    locale,
    ownedByDefinition,
    ownedOnly,
    pathId,
    query,
    t,
  ]);

  function addBuild(characterId: string) {
    if (!data) return;
    const definition = data.characters.byId.get(characterId);
    if (!definition) return;
    const owned = ownedByDefinition.get(characterId);
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
        owned?.key,
        account?.relics ?? [],
        data.relicSets.values,
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

  const activeFilterCount =
    Number(query.trim().length > 0) +
    Number(pathId !== "all") +
    Number(combatTypeId !== "all") +
    Number(ownedOnly);

  const renderFilterPanel = (
    references: NonNullable<typeof data>,
    className?: string
  ) => (
    <Card
      className={cn(
        "overflow-hidden lg:sticky lg:top-3 lg:max-h-[calc(100dvh-9.5rem)]",
        className
      )}
    >
      <CardContent className="space-y-4 overflow-y-auto p-4">
        <label className="block">
          <span className="sr-only">{t("common.search")}</span>
          <span className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              placeholder={t("build.searchPlaceholder")}
              className="h-9 w-full rounded-md border border-border bg-background/70 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <SelectField
            label={t("filter.path")}
            value={pathId}
            options={[
              { value: "all", label: t("filter.allPaths") },
              ...references.properties.paths.map((path) => ({
                value: path.id,
                label: localizedName(path.name, locale, path.id),
              })),
            ]}
            onChange={setPathId}
          />
          <SelectField
            label={t("filter.combatType")}
            value={combatTypeId}
            options={[
              {
                value: "all",
                label: t("filter.allCombatTypes"),
              },
              ...references.properties.combatTypes.map((combatType) => ({
                value: combatType.id,
                label: localizedName(combatType.name, locale, combatType.id),
              })),
            ]}
            onChange={setCombatTypeId}
          />
          <ToggleField
            label={t("build.ownedOnly")}
            description={
              account
                ? t("build.ownedOnlyHelp")
                : t("build.ownedOnlyUnavailable")
            }
            checked={ownedOnly}
            disabled={!account}
            onChange={setOwnedOnly}
          />
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t("build.catalogCount", {
            shown: visibleCharacters.length,
            total: references.characters.values.length,
          })}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <>
      <PageHeader
        titleKey="route.builds.title"
        descriptionKey="route.builds.description"
        visuallyHidden
      />
      <BuildWorkspaceActions references={data} />
      {createError && <StatusBanner message={createError} tone="error" />}
      {loading ? (
        <CatalogLoading />
      ) : error || !data ? (
        <CatalogLoadError error={error} />
      ) : (
        <div className="min-w-0 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-2 xl:grid-cols-[17.5rem_minmax(0,1fr)] 2xl:grid-cols-[15rem_minmax(0,1fr)] 3xl:grid-cols-[17.5rem_minmax(0,1fr)] 3xl:gap-3">
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
                  {t("route.builds.description")}
                </SheetDescription>
                {renderFilterPanel(
                  data,
                  "mt-4 border-0 bg-transparent shadow-none lg:static"
                )}
              </SheetContent>
            </Sheet>
          </div>

          <div className="hidden min-w-0 lg:block">
            {renderFilterPanel(data)}
          </div>

          <div className="min-w-0 space-y-4">
            {visibleCharacters.map((character) => {
              const owned = ownedByDefinition.get(character.id);
              const equippedLightCone = owned?.lightConeKey
                ? lightConeByKey.get(owned.lightConeKey)
                : undefined;
              return (
                <CharacterBuildCard
                  key={character.id}
                  character={character}
                  ownedCharacter={owned}
                  equippedLightCone={equippedLightCone}
                  builds={buildsByCharacter.get(character.id) ?? []}
                  profiles={profilesById}
                  references={data}
                  onAddBuild={() => addBuild(character.id)}
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
        </div>
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
