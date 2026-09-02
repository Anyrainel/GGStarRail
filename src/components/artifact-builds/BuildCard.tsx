import { ChevronDown, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ChoiceChip,
  NumberField,
  SelectField,
  TextField,
  ToggleField,
} from "@/components/builds/BuildControls";
import { AssetImage } from "@/components/shared/AssetImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RelicSlot } from "@/domain/account/schemas";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import { useI18n } from "@/i18n/I18nContext";
import type { BuildReferences } from "@/lib/buildReferences";
import {
  localizedName,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
import type { RelicSlotId } from "@/providers/gilore/types";

const BUILD_SLOTS = [
  ["head", "HEAD", false],
  ["hands", "HAND", false],
  ["body", "BODY", true],
  ["feet", "FOOT", true],
  ["planarSphere", "NECK", true],
  ["linkRope", "OBJECT", true],
] as const satisfies readonly [RelicSlot, RelicSlotId, boolean][];

interface BuildCardProps {
  build: BuildConfiguration;
  profile: ScoreProfile;
  references: BuildReferences;
  onBuildChange: (build: BuildConfiguration) => void;
  onProfileChange: (profile: ScoreProfile) => void;
  onDelete: () => void;
}

export function BuildCard({
  build,
  profile,
  references,
  onBuildChange,
  onProfileChange,
  onDelete,
}: BuildCardProps) {
  const { locale, t } = useI18n();
  const [nameDraft, setNameDraft] = useState(build.name);

  useEffect(() => {
    setNameDraft(build.name);
  }, [build.name]);

  const cavernSets = useMemo(
    () =>
      references.relicSets.values
        .filter((set) => set.kind === "cavern_relic")
        .map((set) => ({
          value: set.id,
          label: localizedName(set.name, locale, set.id),
          iconPath: set.icon_path,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    [locale, references.relicSets.values]
  );
  const planarSets = useMemo(
    () =>
      references.relicSets.values
        .filter((set) => set.kind === "planar_ornament")
        .map((set) => ({
          value: set.id,
          label: localizedName(set.name, locale, set.id),
          iconPath: set.icon_path,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    [locale, references.relicSets.values]
  );
  const fourPieceSetId =
    build.cavern.mode === "four-piece"
      ? build.cavern.setId
      : build.cavern.setIds[0];
  const cavernSet = references.relicSets.byId.get(fourPieceSetId);
  const planarSet = references.relicSets.byId.get(build.planarSetId);
  const weightedProperties = Object.entries(profile.statWeights)
    .map(([propertyId, weight]) => ({
      propertyId,
      weight,
      property: references.properties.propertyById.get(propertyId),
    }))
    .sort(
      (left, right) =>
        right.weight - left.weight ||
        (left.property?.display_order ?? 999) -
          (right.property?.display_order ?? 999)
    );

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
    onBuildChange({
      ...build,
      preferredMainStats: {
        ...build.preferredMainStats,
        [slot]: next,
      },
    });
  }

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
    onProfileChange({
      ...profile,
      gradeThresholds: {
        ...current,
        [grade]: Math.min(maximum, Math.max(minimum, rawValue)),
      },
    });
  }

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-background/35">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/35 px-3 py-2">
        <label className="min-w-40 flex-1">
          <span className="sr-only">{t("build.name")}</span>
          <input
            value={nameDraft}
            aria-label={t("build.name")}
            className="h-8 w-full rounded-full border-0 bg-transparent px-3 text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={() => {
              const nextName = nameDraft.trim();
              if (nextName) onBuildChange({ ...build, name: nextName });
              else setNameDraft(build.name);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </label>
        <Badge variant="outline" className="gap-1.5">
          <AssetImage
            kind="relic-set"
            id={cavernSet?.id ?? fourPieceSetId}
            sourcePath={cavernSet?.icon_path ?? ""}
            alt=""
            className="h-5 w-5 rounded object-contain"
          />
          {t("build.cavernFourPiece")}
        </Badge>
        <Badge variant="outline" className="gap-1.5">
          <AssetImage
            kind="relic-set"
            id={planarSet?.id ?? build.planarSetId}
            sourcePath={planarSet?.icon_path ?? ""}
            alt=""
            className="h-5 w-5 rounded object-contain"
          />
          {t("build.planarTwoPiece")}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("build.delete")}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid min-w-0 gap-3 p-3 xl:grid-cols-[minmax(14rem,0.7fr)_minmax(0,1.3fr)]">
        <section className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <SelectField
            label={t("build.cavernFourPiece")}
            value={fourPieceSetId}
            options={cavernSets}
            onChange={(setId) =>
              onBuildChange({
                ...build,
                cavern: { mode: "four-piece", setId },
              })
            }
          />
          <SelectField
            label={t("build.planarTwoPiece")}
            value={build.planarSetId}
            options={planarSets}
            onChange={(planarSetId) => onBuildChange({ ...build, planarSetId })}
          />
          {build.cavern.mode === "two-plus-two" && (
            <p className="rounded-md border border-border bg-muted/30 p-2 text-xs leading-5 text-muted-foreground sm:col-span-2 xl:col-span-1">
              {t("build.legacyTwoPlusTwo")}
            </p>
          )}
        </section>

        <section className="min-w-0">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {BUILD_SLOTS.map(([slot, catalogSlot, configurable]) => {
              const slotDefinition =
                references.properties.relicSlotById.get(catalogSlot);
              const validProperties =
                slotDefinition?.valid_main_properties ?? [];
              const selectedProperties = configurable
                ? build.preferredMainStats[
                    slot as keyof BuildConfiguration["preferredMainStats"]
                  ]
                : validProperties.slice(0, 1);
              return (
                <fieldset
                  key={slot}
                  className="min-w-0 rounded-lg border border-border/70 bg-muted/20 p-2"
                >
                  <legend className="px-1 text-xs font-medium text-muted-foreground">
                    {localizedName(slotDefinition?.name, locale, slot)}
                  </legend>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {validProperties.map((propertyId) => {
                      const selected = selectedProperties.includes(propertyId);
                      return (
                        <ChoiceChip
                          key={propertyId}
                          selected={selected}
                          disabled={
                            !configurable ||
                            (selected && selectedProperties.length === 1)
                          }
                          onClick={() => {
                            if (configurable) {
                              changeMainStat(
                                slot as keyof BuildConfiguration["preferredMainStats"],
                                propertyId
                              );
                            }
                          }}
                        >
                          {localizedPropertyName(
                            propertyId,
                            references.properties,
                            locale
                          )}
                        </ChoiceChip>
                      );
                    })}
                  </div>
                  {!configurable && (
                    <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
                      {t("build.fixedMainStat")}
                    </p>
                  )}
                </fieldset>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t("scoring.weightsTitle")}:</span>
            {weightedProperties
              .filter(({ weight }) => weight > 0)
              .slice(0, 6)
              .map(({ propertyId, weight }) => (
                <Badge key={propertyId} variant="secondary">
                  {localizedPropertyName(
                    propertyId,
                    references.properties,
                    locale
                  )}{" "}
                  {Math.round(weight * 100)}
                </Badge>
              ))}
          </div>
        </section>
      </div>

      <details className="group border-t border-border/70">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          {t("build.scoringConfigure")}
        </summary>
        <div className="grid min-w-0 gap-4 border-t border-border/50 p-3 xl:grid-cols-[minmax(15rem,0.45fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <TextField
              label={t("scoring.profileName")}
              value={profile.name}
              onChange={(name) => {
                if (name.trim()) onProfileChange({ ...profile, name });
              }}
            />
            <ToggleField
              label={t("scoring.includeMain")}
              description={t("scoring.includeMainHelp")}
              checked={profile.includeMainStat}
              onChange={(includeMainStat) =>
                onProfileChange({ ...profile, includeMainStat })
              }
            />
            {profile.includeMainStat && (
              <label className="block rounded-lg border border-border bg-background/40 p-3 text-sm">
                <span className="flex items-center justify-between gap-2">
                  <span>{t("scoring.mainWeight")}</span>
                  <span className="tabular-nums">
                    {Math.round(profile.mainStatWeight * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(profile.mainStatWeight * 100)}
                  className="mt-2 w-full accent-primary"
                  aria-label={t("scoring.mainWeight")}
                  onChange={(event) =>
                    onProfileChange({
                      ...profile,
                      mainStatWeight: Number(event.target.value) / 100,
                    })
                  }
                />
              </label>
            )}
            <div className="grid grid-cols-2 gap-2">
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
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {weightedProperties.map(({ propertyId, weight }) => (
              <label
                key={propertyId}
                className="min-w-0 rounded-lg border border-border bg-background/40 p-2 text-sm"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {localizedPropertyName(
                      propertyId,
                      references.properties,
                      locale
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {Math.round(weight * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(weight * 100)}
                  className="mt-2 w-full accent-primary"
                  aria-label={localizedPropertyName(
                    propertyId,
                    references.properties,
                    locale
                  )}
                  onChange={(event) =>
                    onProfileChange({
                      ...profile,
                      statWeights: {
                        ...profile.statWeights,
                        [propertyId]: Number(event.target.value) / 100,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      </details>
    </article>
  );
}
