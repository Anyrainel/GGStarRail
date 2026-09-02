import { CircleGauge, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CatalogLoadError,
  CatalogLoading,
} from "@/components/account/CatalogLoadState";
import {
  GradeBadge,
  NumberField,
  ScoreBar,
  SelectField,
  TextField,
  ToggleField,
} from "@/components/builds/BuildControls";
import { BuildWorkspaceActions } from "@/components/builds/BuildWorkspaceActions";
import { ConfirmDialog } from "@/components/builds/ConfirmDialog";
import { RelicScoreCard } from "@/components/builds/RelicScoreCard";
import { SourceCoverageNotice } from "@/components/builds/SourceCoverageNotice";
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
import { APP_PATHS } from "@/config/navigation";
import { createCharacterScoreProfile } from "@/domain/build/configuration";
import {
  BUILD_SLOT_ORDER,
  evaluateEquippedBuild,
} from "@/domain/build/evaluation";
import type { ScoreProfile } from "@/domain/build/schemas";
import { scoreRelic } from "@/domain/build/scoring";
import { useBuildReferences } from "@/hooks/useCatalogReferences";
import { useI18n } from "@/i18n/I18nContext";
import { createRelicScoringContext } from "@/lib/buildReferences";
import {
  characterCatalogPresentation,
  localizedName,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
import type { RelicSlotId } from "@/providers/gilore/types";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const DOMAIN_SLOT_TO_CATALOG = {
  head: "HEAD",
  hands: "HAND",
  body: "BODY",
  feet: "FOOT",
  planarSphere: "NECK",
  linkRope: "OBJECT",
} as const satisfies Record<(typeof BUILD_SLOT_ORDER)[number], RelicSlotId>;

export default function ScoringPage() {
  const { locale, t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const profiles = useWorkspaceStore((state) => state.scoreProfiles);
  const upsertProfile = useWorkspaceStore((state) => state.upsertScoreProfile);
  const removeProfile = useWorkspaceStore((state) => state.removeScoreProfile);
  const { data, error, loading } = useBuildReferences();
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedBuildId, setSelectedBuildId] = useState("");
  const [newCharacterId, setNewCharacterId] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const profile =
    profiles.find((candidate) => candidate.id === selectedProfileId) ??
    profiles[0] ??
    null;
  const profileBuilds = profile
    ? builds.filter((build) => build.scoreProfileId === profile.id)
    : [];
  const selectedBuild =
    profileBuilds.find((build) => build.id === selectedBuildId) ??
    profileBuilds[0] ??
    null;
  const scoringContext = useMemo(
    () => (data ? createRelicScoringContext(data) : null),
    [data]
  );
  const characterOptions = useMemo(() => {
    if (!data) return [];
    return data.characters.values
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
  }, [data, locale, t]);
  const createCharacterId = newCharacterId || characterOptions[0]?.value || "";

  const scoredRelics = useMemo(() => {
    if (!account || !profile || !scoringContext) return [];
    return account.relics
      .map((relic) => ({
        relic,
        score: scoreRelic(
          relic,
          profile,
          scoringContext,
          selectedBuild ?? undefined
        ),
      }))
      .sort(
        (left, right) =>
          Number(right.score.grade !== null) -
            Number(left.score.grade !== null) ||
          right.score.total - left.score.total ||
          left.relic.key.localeCompare(right.relic.key)
      );
  }, [account, profile, scoringContext, selectedBuild]);

  const equipped = useMemo(() => {
    if (!account || !profile || !scoringContext || !selectedBuild) return null;
    return evaluateEquippedBuild(
      account,
      selectedBuild,
      profile,
      scoringContext
    );
  }, [account, profile, scoringContext, selectedBuild]);

  function createProfile() {
    if (!data || !createCharacterId) return;
    const definition = data.characters.byId.get(createCharacterId);
    if (!definition) return;
    const name = characterCatalogPresentation(
      definition,
      data.properties,
      locale,
      t("terms.trailblazer")
    ).name;
    const next = createCharacterScoreProfile(
      definition,
      data.progression,
      t("build.defaultProfileName", { character: name })
    );
    upsertProfile(next);
    setSelectedProfileId(next.id);
  }

  function updateProfile(next: ScoreProfile) {
    upsertProfile(next);
  }

  function deleteProfile() {
    if (!profile) return;
    removeProfile(profile.id);
    setSelectedProfileId("");
    setSelectedBuildId("");
    setDeleteOpen(false);
  }

  return (
    <>
      <PageHeader
        titleKey="route.scoring.title"
        descriptionKey="route.scoring.description"
      />
      <BuildWorkspaceActions references={data} />
      <SourceCoverageNotice account={account} />
      {loading ? (
        <CatalogLoading />
      ) : error || !data || !scoringContext ? (
        <CatalogLoadError error={error} />
      ) : (
        <>
          <Card className="overflow-hidden">
            <CardContent className="grid gap-3 p-3 md:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_auto] md:items-end">
              {profiles.length > 0 ? (
                <SelectField
                  label={t("scoring.profile")}
                  value={profile?.id ?? ""}
                  options={profiles.map((candidate) => ({
                    value: candidate.id,
                    label: candidate.name,
                  }))}
                  onChange={(id) => {
                    setSelectedProfileId(id);
                    setSelectedBuildId("");
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("scoring.noProfiles")}
                </p>
              )}
              {characterOptions.length > 0 && (
                <SelectField
                  label={t("scoring.profileCharacter")}
                  value={createCharacterId}
                  options={characterOptions}
                  onChange={setNewCharacterId}
                />
              )}
              <Button
                type="button"
                disabled={!createCharacterId}
                onClick={createProfile}
              >
                <Plus className="h-4 w-4" aria-hidden />
                {t("scoring.createProfile")}
              </Button>
            </CardContent>
          </Card>
          {profile ? (
            <>
              <ProfileEditor
                profile={profile}
                data={data}
                linkedBuildCount={profileBuilds.length}
                onChange={updateProfile}
                onDelete={() => setDeleteOpen(true)}
              />
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border bg-gradient-select p-4">
                  <CardTitle className="text-sm">
                    {t("scoring.contextTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t("scoring.contextHelp")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {profileBuilds.length > 0 ? (
                    <SelectField
                      label={t("scoring.buildContext")}
                      value={selectedBuild?.id ?? ""}
                      options={profileBuilds.map((build) => ({
                        value: build.id,
                        label: build.name,
                      }))}
                      onChange={setSelectedBuildId}
                      className="max-w-xl"
                    />
                  ) : (
                    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        {t("scoring.noBuildContext")}
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <Link to={APP_PATHS.builds}>
                          {t("scoring.openBuilds")}
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              {equipped && selectedBuild && (
                <Card className="overflow-hidden">
                  <CardHeader className="border-b border-border bg-gradient-select p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm">
                          {t("scoring.equippedTitle", {
                            name: selectedBuild.name,
                          })}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {t("scoring.equippedHelp")}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={equipped.complete ? "secondary" : "outline"}
                        >
                          {equipped.complete
                            ? t("scoring.sixSlotsComplete")
                            : t("scoring.slotsMissing", {
                                count: equipped.missingSlots.length,
                              })}
                        </Badge>
                        <Badge
                          variant={
                            equipped.cavernSetComplete &&
                            equipped.planarSetComplete
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {equipped.cavernSetComplete &&
                          equipped.planarSetComplete
                            ? t("scoring.setsComplete")
                            : t("scoring.setsIncomplete")}
                        </Badge>
                        <Badge
                          variant={
                            equipped.mainStatsComplete ? "secondary" : "outline"
                          }
                        >
                          {equipped.mainStatsComplete
                            ? t("scoring.mainStatsComplete")
                            : t("scoring.mainStatsIncomplete")}
                        </Badge>
                        <Badge
                          variant={
                            equipped.filterCriteriaComplete
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {equipped.filterCriteriaComplete
                            ? t("scoring.filterCriteriaComplete")
                            : t("scoring.filterCriteriaIncomplete")}
                        </Badge>
                        <Badge className="tabular-nums">
                          {t("scoring.average", {
                            value: equipped.averageScore?.toFixed(1) ?? "—",
                          })}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                    {BUILD_SLOT_ORDER.map((slot) => {
                      const selected = equipped.selected[slot];
                      if (selected) {
                        return (
                          <RelicScoreCard
                            key={slot}
                            relic={selected.relic}
                            score={selected.score}
                            references={data}
                            locale={locale}
                            selected
                          />
                        );
                      }
                      const slotDefinition = data.properties.relicSlotById.get(
                        DOMAIN_SLOT_TO_CATALOG[slot]
                      );
                      return (
                        <div
                          key={slot}
                          className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border bg-background/30 p-4 text-center text-sm text-muted-foreground"
                        >
                          {t("scoring.missingSlot", {
                            slot: localizedName(
                              slotDefinition?.name,
                              locale,
                              slot
                            ),
                          })}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border bg-gradient-select p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm">
                        {t("scoring.inventoryTitle")}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {t("scoring.inventoryHelp")}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {t("scoring.showingTop", {
                        shown: Math.min(30, scoredRelics.length),
                        total: scoredRelics.length,
                      })}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                  {scoredRelics.slice(0, 30).map(({ relic, score }) => (
                    <RelicScoreCard
                      key={relic.key}
                      relic={relic}
                      score={score}
                      references={data}
                      locale={locale}
                    >
                      <div className="grid gap-2">
                        <ScoreBar
                          value={score.substatScore}
                          label={t("scoring.substatScore")}
                        />
                        {profile.includeMainStat && (
                          <ScoreBar
                            value={score.mainStatScore}
                            label={t("scoring.mainStatScore")}
                          />
                        )}
                        {!score.mainStatAccepted && (
                          <p className="text-xs text-muted-foreground">
                            {t("scoring.offTargetMain")}
                          </p>
                        )}
                      </div>
                    </RelicScoreCard>
                  ))}
                  {scoredRelics.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t("scoring.noRelics")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <CircleGauge className="h-6 w-6 text-primary" aria-hidden />
                <p className="max-w-md text-sm text-muted-foreground">
                  {t("scoring.createFirst")}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("scoring.deleteProfile")}
        description={t("scoring.deleteConfirm", {
          name: profile?.name ?? "",
          count: profileBuilds.length,
        })}
        confirmLabel={t("scoring.deleteProfile")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={deleteProfile}
      />
    </>
  );
}

interface ProfileEditorProps {
  profile: ScoreProfile;
  data: NonNullable<ReturnType<typeof useBuildReferences>["data"]>;
  linkedBuildCount: number;
  onChange: (profile: ScoreProfile) => void;
  onDelete: () => void;
}

function ProfileEditor({
  profile,
  data,
  linkedBuildCount,
  onChange,
  onDelete,
}: ProfileEditorProps) {
  const { locale, t } = useI18n();
  const weightedProperties = Object.entries(profile.statWeights)
    .map(([propertyId, weight]) => ({
      propertyId,
      weight,
      property: data.properties.propertyById.get(propertyId),
    }))
    .sort(
      (left, right) =>
        (left.property?.display_order ?? 999) -
          (right.property?.display_order ?? 999) ||
        left.propertyId.localeCompare(right.propertyId)
    );

  function updateThreshold(
    grade: keyof ScoreProfile["gradeThresholds"],
    rawValue: number
  ) {
    const current = profile.gradeThresholds;
    const ranges = {
      s: [current.a + 1, 100],
      a: [current.b + 1, current.s - 1],
      b: [current.c + 1, current.a - 1],
      c: [0, current.b - 1],
    } as const;
    const [minimum, maximum] = ranges[grade];
    onChange({
      ...profile,
      gradeThresholds: {
        ...current,
        [grade]: Math.min(maximum, Math.max(minimum, rawValue)),
      },
    });
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(18rem,0.35fr)_minmax(0,1fr)]">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border bg-gradient-select p-4">
          <div>
            <CardTitle className="text-sm">
              {t("scoring.settingsTitle")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("scoring.linkedBuilds", { count: linkedBuildCount })}
            </CardDescription>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("scoring.deleteProfile")}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <TextField
            label={t("scoring.profileName")}
            value={profile.name}
            onChange={(name) => {
              if (name.trim()) onChange({ ...profile, name });
            }}
          />
          <ToggleField
            label={t("scoring.includeMain")}
            description={t("scoring.includeMainHelp")}
            checked={profile.includeMainStat}
            onChange={(includeMainStat) =>
              onChange({ ...profile, includeMainStat })
            }
          />
          {profile.includeMainStat && (
            <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <label htmlFor={`main-weight-${profile.id}`}>
                  {t("scoring.mainWeight")}
                </label>
                <span className="font-medium tabular-nums">
                  {Math.round(profile.mainStatWeight * 100)}%
                </span>
              </div>
              <input
                id={`main-weight-${profile.id}`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(profile.mainStatWeight * 100)}
                className="w-full accent-primary"
                onChange={(event) =>
                  onChange({
                    ...profile,
                    mainStatWeight: Number(event.target.value) / 100,
                  })
                }
              />
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("scoring.gradesTitle")}</p>
            <p className="text-xs leading-5 text-muted-foreground">
              {t("scoring.gradesHelp")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(["s", "a", "b", "c"] as const).map((grade) => (
                <NumberField
                  key={grade}
                  label={t("scoring.gradeThreshold", {
                    grade: grade.toUpperCase(),
                  })}
                  value={profile.gradeThresholds[grade]}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(value) => updateThreshold(grade, value)}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="border-b border-border bg-gradient-select p-4">
          <CardTitle className="text-sm">{t("scoring.weightsTitle")}</CardTitle>
          <CardDescription className="text-xs">
            {t("scoring.weightsHelp")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 p-4 sm:grid-cols-2">
          {weightedProperties.map(({ propertyId, weight }) => (
            <div
              key={propertyId}
              className="min-w-0 space-y-2 rounded-lg border border-border bg-background/40 p-3"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <label
                  htmlFor={`weight-${profile.id}-${propertyId}`}
                  className="min-w-0 truncate"
                >
                  {localizedPropertyName(propertyId, data.properties, locale)}
                </label>
                <span className="shrink-0 font-medium tabular-nums">
                  {Math.round(weight * 100)}%
                </span>
              </div>
              <input
                id={`weight-${profile.id}-${propertyId}`}
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(weight * 100)}
                className="w-full accent-primary"
                onChange={(event) =>
                  onChange({
                    ...profile,
                    statWeights: {
                      ...profile.statWeights,
                      [propertyId]: Number(event.target.value) / 100,
                    },
                  })
                }
              />
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
            <GradeBadge grade="S" />
            <span>{t("scoring.normalizationNote")}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
