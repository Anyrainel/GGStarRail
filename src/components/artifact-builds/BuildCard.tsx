import { ChevronDown, MoreVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ChoiceChip,
  NumberField,
  TextField,
  ToggleField,
} from "@/components/builds/BuildControls";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RelicSlot } from "@/domain/account/schemas";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import { useI18n } from "@/i18n/I18nContext";
import type { BuildReferences } from "@/lib/buildReferences";
import {
  localizedName,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
import { createRelicSetRarityMap } from "@/lib/relicRarity";
import type { RelicSetDefinition, RelicSlotId } from "@/providers/gilore/types";

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

interface SetPickerProps {
  label: string;
  pieceCount: 2 | 4;
  rarity: number | null;
  value: string;
  options: readonly {
    value: string;
    label: string;
    iconPath: string;
  }[];
  set: RelicSetDefinition | undefined;
  onChange: (value: string) => void;
}

function SetPicker({
  label,
  pieceCount,
  rarity,
  value,
  options,
  set,
  onChange,
}: SetPickerProps) {
  const selected = options.find((option) => option.value === value);
  const name = selected?.label ?? value;

  return (
    <label className="group flex min-w-0 cursor-pointer flex-col items-center gap-1">
      <span className="relative rounded-lg outline-none transition-transform group-hover:scale-105 group-focus-within:scale-105 group-focus-within:ring-2 group-focus-within:ring-ring">
        <ItemIcon
          kind="relic-set"
          id={set?.id ?? value}
          sourcePath={set?.icon_path ?? selected?.iconPath ?? ""}
          alt={`${label}: ${name}`}
          rarity={rarity}
          badge={pieceCount}
          size="md"
        />
        <select
          value={value}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-[0.01]"
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
      <span className="line-clamp-2 max-w-20 text-center text-[0.68rem] font-medium leading-tight text-foreground">
        {name}
      </span>
    </label>
  );
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
  const setRarityById = useMemo(
    () => createRelicSetRarityMap(references.relicPieces.values),
    [references.relicPieces.values]
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
    <article
      className="overflow-hidden rounded-lg border border-border/50 bg-muted/30"
      data-build-card
    >
      <div className="px-2 pt-2 md:px-3">
        <div className="flex min-w-0 items-center gap-2">
          <label className="min-w-0 flex-1 px-1 md:px-2">
            <span className="sr-only">{t("build.name")}</span>
            <input
              value={nameDraft}
              aria-label={t("build.name")}
              className="h-8 w-full rounded-full border-0 bg-transparent px-2 text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-3 md:text-base 2xl:px-2 2xl:text-sm 3xl:px-3 3xl:text-base"
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-1 md:h-8 md:w-8"
                aria-label={t("common.more")}
              >
                <MoreVertical className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={onDelete}
              >
                <Trash2 />
                {t("build.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="px-2 py-1.5 md:py-2">
        <div className="border-t border-border/30 pt-2">
          <div className="flex min-w-0 flex-col items-center justify-center gap-2 sm:flex-row sm:items-start md:gap-3 2xl:gap-2 3xl:gap-3">
            <section className="grid w-full shrink-0 grid-cols-2 gap-2 sm:w-44 2xl:w-40 2xl:gap-1 3xl:w-44 3xl:gap-2">
              <SetPicker
                label={t("build.cavernFourPiece")}
                pieceCount={4}
                rarity={setRarityById.get(fourPieceSetId) ?? null}
                value={fourPieceSetId}
                options={cavernSets}
                set={cavernSet}
                onChange={(setId) =>
                  onBuildChange({
                    ...build,
                    cavern: { mode: "four-piece", setId },
                  })
                }
              />
              <SetPicker
                label={t("build.planarTwoPiece")}
                pieceCount={2}
                rarity={setRarityById.get(build.planarSetId) ?? null}
                value={build.planarSetId}
                options={planarSets}
                set={planarSet}
                onChange={(planarSetId) =>
                  onBuildChange({ ...build, planarSetId })
                }
              />
            </section>

            <section className="w-full min-w-0 flex-1 space-y-1.5 md:space-y-2 2xl:space-y-1 3xl:space-y-2">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:gap-2 xl:grid-cols-6 2xl:grid-cols-3 2xl:gap-1 3xl:grid-cols-6 3xl:gap-2">
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
                  const availableProperties = validProperties.filter(
                    (propertyId) => !selectedProperties.includes(propertyId)
                  );
                  const slotName = localizedName(
                    slotDefinition?.name,
                    locale,
                    slot
                  );
                  return (
                    <fieldset
                      key={slot}
                      className="min-w-0 space-y-0.5"
                      data-build-slot={slot}
                    >
                      <legend className="max-w-full truncate text-[0.65rem] font-medium text-muted-foreground md:text-xs 2xl:text-[0.65rem] 3xl:text-xs">
                        {slotName}
                      </legend>
                      <div className="flex min-h-8 flex-wrap items-center gap-1 [&_button:disabled]:cursor-default [&_button:disabled]:opacity-100 [&_button]:min-h-7 [&_button]:px-2 [&_button]:text-[0.68rem] md:[&_button]:min-h-8 md:[&_button]:px-2.5 md:[&_button]:text-xs 2xl:[&_button]:min-h-7 2xl:[&_button]:px-2 2xl:[&_button]:text-[0.68rem] 3xl:[&_button]:min-h-8 3xl:[&_button]:px-2.5 3xl:[&_button]:text-xs">
                        {selectedProperties.map((propertyId) => (
                          <ChoiceChip
                            key={propertyId}
                            selected
                            disabled={
                              !configurable || selectedProperties.length === 1
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
                        ))}
                        {configurable && availableProperties.length > 0 && (
                          <label className="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-border/60 text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground">
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            <select
                              value=""
                              aria-label={`${slotName}: ${t("build.mainStatsTitle")}`}
                              className="absolute inset-0 cursor-pointer opacity-0"
                              onChange={(event) => {
                                if (event.target.value) {
                                  changeMainStat(
                                    slot as keyof BuildConfiguration["preferredMainStats"],
                                    event.target.value
                                  );
                                }
                              }}
                            >
                              <option value="">+</option>
                              {availableProperties.map((propertyId) => (
                                <option key={propertyId} value={propertyId}>
                                  {localizedPropertyName(
                                    propertyId,
                                    references.properties,
                                    locale
                                  )}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                      {!configurable && (
                        <span className="sr-only">
                          {t("build.fixedMainStat")}
                        </span>
                      )}
                    </fieldset>
                  );
                })}
              </div>

              <div className="flex min-h-8 flex-wrap items-center gap-1 text-xs text-muted-foreground md:gap-1.5 2xl:gap-1 3xl:gap-1.5">
                <span className="font-medium">
                  {t("scoring.weightsTitle")}:
                </span>
                {weightedProperties
                  .filter(({ weight }) => weight > 0)
                  .slice(0, 6)
                  .map(({ propertyId, weight }) => (
                    <Badge
                      key={propertyId}
                      variant="secondary"
                      className="h-6 px-2 text-[0.68rem] 3xl:text-xs"
                    >
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

          {build.cavern.mode === "two-plus-two" && (
            <p className="mt-2 rounded-md border border-border bg-background/40 p-2 text-xs leading-5 text-muted-foreground">
              {t("build.legacyTwoPlusTwo")}
            </p>
          )}
        </div>
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
