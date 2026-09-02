import { Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import {
  ChoiceChip,
  SelectField,
  TextField,
  ToggleField,
} from "@/components/builds/BuildControls";
import { BuildWorkspaceActions } from "@/components/builds/BuildWorkspaceActions";
import { ConfirmDialog } from "@/components/builds/ConfirmDialog";
import { StatusBanner } from "@/components/builds/StatusBanner";
import { AssetImage } from "@/components/shared/AssetImage";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RelicSlot } from "@/domain/account/schemas";
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
  localizedPropertyName,
  localizedSearchText,
} from "@/lib/catalogPresentation";
import { cn } from "@/lib/utils";
import type { RelicSlotId } from "@/providers/gilore/types";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const EDITABLE_SLOTS = [
  ["body", "BODY"],
  ["feet", "FOOT"],
  ["planarSphere", "NECK"],
  ["linkRope", "OBJECT"],
] as const satisfies readonly [
  Exclude<RelicSlot, "head" | "hands">,
  RelicSlotId,
][];

export default function BuildsPage() {
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
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pathId, setPathId] = useState("all");
  const [combatTypeId, setCombatTypeId] = useState("all");
  const [ownedOnly, setOwnedOnly] = useState(() => Boolean(account));
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BuildConfiguration | null>(
    null
  );

  const selectedBuild =
    builds.find((build) => build.id === selectedBuildId) ?? builds[0] ?? null;
  const ownedDefinitionIds = useMemo(
    () =>
      new Set(
        (account?.characters ?? []).map((character) => character.definitionId)
      ),
    [account]
  );
  const buildCountByCharacter = useMemo(() => {
    const counts = new Map<string, number>();
    for (const build of builds) {
      counts.set(
        build.characterDefinitionId,
        (counts.get(build.characterDefinitionId) ?? 0) + 1
      );
    }
    return counts;
  }, [builds]);
  const filteredCharacters = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLocaleLowerCase();
    return [...data.characters.values]
      .filter((character) => {
        if (ownedOnly && !ownedDefinitionIds.has(character.id)) return false;
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
      .sort(
        (left, right) =>
          right.rarity - left.rarity ||
          characterCatalogPresentation(
            left,
            data.properties,
            locale,
            t("terms.trailblazer")
          ).label.localeCompare(
            characterCatalogPresentation(
              right,
              data.properties,
              locale,
              t("terms.trailblazer")
            ).label,
            locale
          )
      );
  }, [
    combatTypeId,
    data,
    locale,
    ownedDefinitionIds,
    ownedOnly,
    pathId,
    query,
    t,
  ]);

  useEffect(() => {
    if (!account && ownedOnly) setOwnedOnly(false);
  }, [account, ownedOnly]);

  function updateBuild(next: BuildConfiguration) {
    upsertBuild(next);
  }

  function handleCreateBuild(characterId: string) {
    if (!data) return;
    const character = account?.characters.find(
      (candidate) => candidate.definitionId === characterId
    );
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
        character?.key,
        account?.relics ?? [],
        data.relicSets.values,
        data.properties,
        data.progression,
        profile.id,
        t("build.defaultBuildName", { character: characterName })
      );
      upsertScoreProfile(profile);
      upsertBuild(build);
      setSelectedBuildId(build.id);
      setCreateError(null);
    } catch {
      setCreateError(t("build.createError"));
    }
  }

  function handleDeleteBuild() {
    if (!pendingDelete) return;
    removeBuild(pendingDelete.id);
    setSelectedBuildId(null);
    setPendingDelete(null);
  }

  return (
    <>
      <PageHeader
        titleKey="route.builds.title"
        descriptionKey="route.builds.description"
      />
      <BuildWorkspaceActions references={data} />
      {loading ? (
        <CatalogLoading />
      ) : error || !data ? (
        <CatalogLoadError error={error} />
      ) : (
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(15rem,17rem)_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-gradient-select p-4">
                <CardTitle className="text-sm">
                  {t("build.catalogTitle")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("build.catalogFilterHelp")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">
                    {t("common.search")}
                  </span>
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
                <SelectField
                  label={t("filter.path")}
                  value={pathId}
                  options={[
                    { value: "all", label: t("filter.allPaths") },
                    ...data.properties.paths.map((path) => ({
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
                    ...data.properties.combatTypes.map((combatType) => ({
                      value: combatType.id,
                      label: localizedName(
                        combatType.name,
                        locale,
                        combatType.id
                      ),
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
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {t("build.catalogCount", {
                    shown: filteredCharacters.length,
                    total: data.characters.values.length,
                  })}
                </p>
              </CardContent>
            </Card>
            {builds.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border bg-gradient-select p-4">
                  <CardTitle className="text-sm">
                    {t("build.savedTitle", { count: builds.length })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-2">
                  {builds.map((build) => {
                    const definition = data.characters.byId.get(
                      build.characterDefinitionId
                    );
                    const presentation = definition
                      ? characterCatalogPresentation(
                          definition,
                          data.properties,
                          locale,
                          t("terms.trailblazer")
                        )
                      : null;
                    const active = selectedBuild?.id === build.id;
                    return (
                      <button
                        key={build.id}
                        type="button"
                        className={cn(
                          "flex w-full min-w-0 items-center gap-3 rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "border-primary/45 bg-primary/10"
                            : "border-border bg-background/40 hover:bg-accent/50"
                        )}
                        aria-pressed={active}
                        onClick={() => setSelectedBuildId(build.id)}
                      >
                        <AssetImage
                          kind="character"
                          id={definition?.id ?? build.characterDefinitionId}
                          sourcePath={definition?.icon_path ?? ""}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-md bg-background/70 object-contain"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {build.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {presentation
                              ? t("build.characterIdentity", {
                                  character: presentation.name,
                                  path: presentation.pathName,
                                  combatType: presentation.combatTypeName,
                                })
                              : build.characterDefinitionId}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </aside>
          <div className="flex min-w-0 flex-col gap-4">
            <Card className={cn("overflow-hidden", selectedBuild && "order-2")}>
              <CardHeader className="border-b border-border bg-gradient-select p-4">
                <CardTitle className="text-sm">{t("build.newTitle")}</CardTitle>
                <CardDescription className="text-xs">
                  {t("build.newHelp")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3">
                {createError && (
                  <StatusBanner
                    message={createError}
                    tone="error"
                    className="mb-3"
                  />
                )}
                {filteredCharacters.length > 0 ? (
                  <div className="grid max-h-[28rem] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:max-h-[32rem] sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {filteredCharacters.map((character) => {
                      const presentation = characterCatalogPresentation(
                        character,
                        data.properties,
                        locale,
                        t("terms.trailblazer")
                      );
                      const owned = ownedDefinitionIds.has(character.id);
                      const count =
                        buildCountByCharacter.get(character.id) ?? 0;
                      const characterIdentity = t("build.characterIdentity", {
                        character: presentation.name,
                        path: presentation.pathName,
                        combatType: presentation.combatTypeName,
                      });
                      return (
                        <button
                          key={character.id}
                          type="button"
                          className="group min-w-0 overflow-hidden rounded-lg border border-border bg-background/45 text-left transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={t("build.createFor", {
                            character: characterIdentity,
                          })}
                          onClick={() => handleCreateBuild(character.id)}
                        >
                          <div className="relative aspect-[5/3] overflow-hidden bg-gradient-select">
                            <AssetImage
                              kind="character"
                              id={character.id}
                              sourcePath={character.icon_path}
                              alt=""
                              className="h-full w-full object-contain object-top transition-transform group-hover:scale-[1.03]"
                            />
                            <span className="absolute right-1.5 top-1.5 rounded-md border border-border bg-background/90 p-1 text-primary">
                              <Plus
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </span>
                          </div>
                          <span className="block space-y-1.5 p-2">
                            <span className="block truncate text-sm font-semibold">
                              {presentation.name}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {t("build.characterMeta", {
                                path: presentation.pathName,
                                combatType: presentation.combatTypeName,
                              })}
                            </span>
                            <span className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-[10px]">
                                {character.rarity} ★
                              </Badge>
                              {owned && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {t("build.owned")}
                                </Badge>
                              )}
                              {count > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {t("build.buildCount", { count })}
                                </Badge>
                              )}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    messageKey="build.noCatalogMatches"
                    icon={Search}
                    className="min-h-40"
                  />
                )}
              </CardContent>
            </Card>
            {selectedBuild ? (
              <div className="order-1">
                <BuildEditor
                  build={selectedBuild}
                  account={account}
                  data={data}
                  scoreProfiles={scoreProfiles}
                  onCreateProfile={upsertScoreProfile}
                  onChange={updateBuild}
                  onDelete={() => setPendingDelete(selectedBuild)}
                />
              </div>
            ) : (
              <EmptyState messageKey="empty.builds" icon={SlidersHorizontal} />
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
        onConfirm={handleDeleteBuild}
      />
    </>
  );
}

interface BuildEditorProps {
  build: BuildConfiguration;
  account: ReturnType<typeof useWorkspaceStore.getState>["account"];
  data: NonNullable<ReturnType<typeof useBuildReferences>["data"]>;
  scoreProfiles: ReturnType<typeof useWorkspaceStore.getState>["scoreProfiles"];
  onCreateProfile: (
    profile: ReturnType<typeof createCharacterScoreProfile>
  ) => void;
  onChange: (build: BuildConfiguration) => void;
  onDelete: () => void;
}

function BuildEditor({
  build,
  account,
  data,
  scoreProfiles,
  onCreateProfile,
  onChange,
  onDelete,
}: BuildEditorProps) {
  const { locale, t } = useI18n();
  const definition = data.characters.byId.get(build.characterDefinitionId);
  const characterPresentation = definition
    ? characterCatalogPresentation(
        definition,
        data.properties,
        locale,
        t("terms.trailblazer")
      )
    : {
        name: build.characterDefinitionId,
        pathName: "",
        combatTypeName: "",
        label: build.characterDefinitionId,
      };
  const cavernSets = data.relicSets.values
    .filter((set) => set.kind === "cavern_relic")
    .map((set) => ({
      value: set.id,
      label: localizedName(set.name, locale, set.id),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, locale));
  const planarSets = data.relicSets.values
    .filter((set) => set.kind === "planar_ornament")
    .map((set) => ({
      value: set.id,
      label: localizedName(set.name, locale, set.id),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, locale));
  const characterOptions = data.characters.values
    .map((character) => {
      const presentation = characterCatalogPresentation(
        character,
        data.properties,
        locale,
        t("terms.trailblazer")
      );
      return {
        value: character.id,
        label: t("build.characterIdentity", {
          character: presentation.name,
          path: presentation.pathName,
          combatType: presentation.combatTypeName,
        }),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, locale));
  const profileOptions = scoreProfiles.map((profile) => ({
    value: profile.id,
    label: profile.name,
  }));

  function changeCharacter(characterId: string) {
    const nextDefinition = data.characters.byId.get(characterId);
    const owned = account?.characters.find(
      (character) => character.definitionId === characterId
    );
    if (!nextDefinition) return;
    const nextCharacterName = characterCatalogPresentation(
      nextDefinition,
      data.properties,
      locale,
      t("terms.trailblazer")
    ).name;
    const nextProfile = createCharacterScoreProfile(
      nextDefinition,
      data.progression,
      t("build.defaultProfileName", { character: nextCharacterName })
    );
    onCreateProfile(nextProfile);
    onChange(
      createCharacterBuild(
        nextDefinition,
        owned?.key,
        account?.relics ?? [],
        data.relicSets.values,
        data.properties,
        data.progression,
        nextProfile.id,
        build.name,
        build.id
      )
    );
  }

  function changeCavernMode(advanced: boolean) {
    if (advanced && build.cavern.mode === "four-piece") {
      const currentSetId = build.cavern.setId;
      const second =
        cavernSets.find((set) => set.value !== currentSetId)?.value ??
        currentSetId;
      if (second === currentSetId) return;
      onChange({
        ...build,
        cavern: {
          mode: "two-plus-two",
          setIds: [currentSetId, second],
        },
      });
      return;
    }
    if (!advanced && build.cavern.mode === "two-plus-two") {
      onChange({
        ...build,
        cavern: { mode: "four-piece", setId: build.cavern.setIds[0] },
      });
    }
  }

  function changeMainStat(
    slot: keyof BuildConfiguration["preferredMainStats"],
    propertyId: string
  ) {
    const selected = build.preferredMainStats[slot];
    const next = selected.includes(propertyId)
      ? selected.length > 1
        ? selected.filter((id) => id !== propertyId)
        : selected
      : [...selected, propertyId];
    onChange({
      ...build,
      preferredMainStats: {
        ...build.preferredMainStats,
        [slot]: next,
      },
    });
  }

  const twoPlusTwoIds =
    build.cavern.mode === "two-plus-two" ? build.cavern.setIds : null;
  const fourPieceSetId =
    build.cavern.mode === "four-piece" ? build.cavern.setId : null;

  return (
    <div className="min-w-0 space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b border-border bg-gradient-select p-4">
          <AssetImage
            kind="character"
            id={definition?.id ?? build.characterDefinitionId}
            sourcePath={definition?.icon_path ?? ""}
            alt={characterPresentation.name}
            className="h-14 w-14 shrink-0 rounded-lg bg-background/70 object-contain"
          />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{build.name}</CardTitle>
            <CardDescription className="truncate text-xs">
              {t("build.characterIdentity", {
                character: characterPresentation.name,
                path: characterPresentation.pathName,
                combatType: characterPresentation.combatTypeName,
              })}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("build.delete")}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          <TextField
            label={t("build.name")}
            value={build.name}
            onChange={(name) => {
              if (name.trim()) onChange({ ...build, name });
            }}
          />
          <SelectField
            label={t("build.character")}
            value={build.characterDefinitionId}
            options={characterOptions}
            help={t("build.characterChangeHelp")}
            onChange={changeCharacter}
          />
          <SelectField
            label={t("build.scoreProfile")}
            value={build.scoreProfileId}
            options={profileOptions}
            disabled={profileOptions.length === 0}
            help={
              profileOptions.length === 0
                ? t("build.scoreProfileMissing")
                : undefined
            }
            onChange={(scoreProfileId) =>
              onChange({ ...build, scoreProfileId })
            }
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-gradient-select p-4">
          <CardTitle className="text-sm">{t("build.setPlanTitle")}</CardTitle>
          <CardDescription className="text-xs">
            {t("build.setPlanHelp")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <ToggleField
            label={t("build.advancedTwoPlusTwo")}
            description={t("build.advancedTwoPlusTwoHelp")}
            checked={build.cavern.mode === "two-plus-two"}
            onChange={changeCavernMode}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {twoPlusTwoIds === null ? (
              <SelectField
                label={t("build.cavernFourPiece")}
                value={fourPieceSetId ?? ""}
                options={cavernSets}
                onChange={(setId) =>
                  onChange({
                    ...build,
                    cavern: { mode: "four-piece", setId },
                  })
                }
              />
            ) : (
              <>
                <SelectField
                  label={t("build.cavernFirstTwoPiece")}
                  value={twoPlusTwoIds[0]}
                  options={cavernSets.filter(
                    (set) => set.value !== twoPlusTwoIds[1]
                  )}
                  onChange={(setId) =>
                    onChange({
                      ...build,
                      cavern: {
                        mode: "two-plus-two",
                        setIds: [setId, twoPlusTwoIds[1]],
                      },
                    })
                  }
                />
                <SelectField
                  label={t("build.cavernSecondTwoPiece")}
                  value={twoPlusTwoIds[1]}
                  options={cavernSets.filter(
                    (set) => set.value !== twoPlusTwoIds[0]
                  )}
                  onChange={(setId) =>
                    onChange({
                      ...build,
                      cavern: {
                        mode: "two-plus-two",
                        setIds: [twoPlusTwoIds[0], setId],
                      },
                    })
                  }
                />
              </>
            )}
            <SelectField
              label={t("build.planarTwoPiece")}
              value={build.planarSetId}
              options={planarSets}
              onChange={(planarSetId) => onChange({ ...build, planarSetId })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-gradient-select p-4">
          <CardTitle className="text-sm">{t("build.mainStatsTitle")}</CardTitle>
          <CardDescription className="text-xs">
            {t("build.mainStatsHelp")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FixedMainStat
              label={t("build.slotHead")}
              value={localizedPropertyName("HPDelta", data.properties, locale)}
            />
            <FixedMainStat
              label={t("build.slotHands")}
              value={localizedPropertyName(
                "AttackDelta",
                data.properties,
                locale
              )}
            />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {EDITABLE_SLOTS.map(([slot, catalogSlot]) => {
              const slotDefinition =
                data.properties.relicSlotById.get(catalogSlot);
              const validProperties =
                slotDefinition?.valid_main_properties ?? [];
              return (
                <section
                  key={slot}
                  className="min-w-0 rounded-lg border border-border bg-background/40 p-3"
                >
                  <h3 className="text-sm font-medium">
                    {localizedName(slotDefinition?.name, locale, slot)}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {validProperties.map((propertyId) => {
                      const selected =
                        build.preferredMainStats[slot].includes(propertyId);
                      return (
                        <ChoiceChip
                          key={propertyId}
                          selected={selected}
                          disabled={
                            selected &&
                            build.preferredMainStats[slot].length === 1
                          }
                          onClick={() => changeMainStat(slot, propertyId)}
                        >
                          {localizedPropertyName(
                            propertyId,
                            data.properties,
                            locale
                          )}
                        </ChoiceChip>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FixedMainStat({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3">
      <span className="text-sm font-medium">{label}</span>
      <Badge variant="outline">
        {value} · {t("build.fixed")}
      </Badge>
    </div>
  );
}
