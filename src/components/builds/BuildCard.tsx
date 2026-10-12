import {
  ArrowDown,
  ArrowUp,
  Copy,
  MoreVertical,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatSelect } from "@/components/builds/StatSelect";
import {
  NumberField,
  TextField,
  ToggleField,
} from "@/components/shared/FieldControls";
import {
  CavernPlanPicker,
  PlanarSetPicker,
} from "@/components/shared/relic/CavernPlanPicker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
} from "@/components/ui/lightweight-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { buildMainStats } from "@/domain/build/configuration";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { cn } from "@/lib/utils";
import type { RelicSlotId } from "@/providers/reference/types";
import { buildDisplayName } from "@/services/builds/presentation";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import { catalogPickerItems } from "@/services/catalog/pickerItems";
import type { PickerItem } from "@/services/catalog/pickerTypes";
import {
  localizedName,
  localizedPropertyName,
} from "@/services/catalog/presentation";
import { shortStatKey } from "@/services/catalog/relicPresentation";

const BUILD_SLOTS = [
  ["body", "BODY"],
  ["feet", "FOOT"],
  ["planarSphere", "NECK"],
  ["linkRope", "OBJECT"],
] as const satisfies readonly [
  "body" | "feet" | "planarSphere" | "linkRope",
  RelicSlotId,
][];

/** The compact stat label used on chips, or the full name when none exists. */
function compactPropertyName(
  propertyId: string,
  fallback: string,
  translate: (key: MessageKey) => string
): string {
  const key = shortStatKey(propertyId);
  return key ? translate(key) : fallback;
}

/** A 4-piece plan is one set ID; a 2+2 plan is two. */
function cavernPlanValue(build: BuildConfiguration): readonly string[] {
  if (build.category !== "cavern") return [];
  return build.cavern.mode === "four-piece"
    ? [build.cavern.setId]
    : build.cavern.setIds;
}

/** Set names under the plan icon; a 2+2 plan shows one clamped line per set. */
function SetPlanNames({ sets }: { sets: readonly PickerItem[] }) {
  if (sets.length === 0) return null;
  return (
    <span
      className="flex w-16 flex-col items-center text-center text-[0.65rem] font-medium leading-tight text-foreground md:text-xs"
      aria-hidden="true"
      data-set-plan-names
    >
      {sets.map((set) => (
        <span
          key={set.id}
          className={cn(
            "w-full break-words",
            sets.length > 1 ? "line-clamp-1" : "line-clamp-2"
          )}
        >
          {set.name}
        </span>
      ))}
    </span>
  );
}

interface BuildCardProps {
  build: BuildConfiguration;
  profile: ScoreProfile;
  references: BuildReferences;
  onBuildChange: (build: BuildConfiguration) => void;
  onProfileChange: (profile: ScoreProfile) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onMove?: (direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

interface WeightTokenProps {
  label: string;
  propertyName: string;
  accessibleName: string;
  weight: number;
  onChange: (weight: number) => void;
}

function WeightToken({
  label,
  propertyName,
  accessibleName,
  weight,
  onChange,
}: WeightTokenProps) {
  const percentage = Math.round(weight * 100);
  const weightClass = cn(
    percentage === 100 && "font-bold text-primary",
    percentage >= 75 && percentage < 100 && "text-primary",
    percentage >= 50 && percentage < 75 && "text-foreground",
    percentage >= 25 && percentage < 50 && "text-foreground",
    percentage < 25 && "text-muted-foreground"
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${accessibleName}: ${percentage}%`}
          className="flex h-7 max-w-full items-center rounded-md border border-border bg-gradient-select text-xs shadow-xs outline-hidden transition-all hover:brightness-110 focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="max-w-20 truncate px-2">{propertyName}</span>
          <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
          <span
            className={cn(
              "min-w-8 px-1.5 font-mono text-[0.68rem]",
              weightClass
            )}
          >
            {percentage}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={8} className="w-64 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <span className="font-mono text-lg font-bold text-primary">
              {percentage}%
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            step={1}
            value={percentage}
            aria-label={`${label}: ${accessibleName}`}
            className="w-full accent-primary"
            onChange={(event) => onChange(Number(event.target.value) / 100)}
          />
          <div className="flex gap-1">
            {[50, 75, 90, 100].map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-6 flex-1 px-0 text-xs",
                  percentage === preset &&
                    "border-primary bg-primary/20 text-primary"
                )}
                onClick={() => onChange(preset / 100)}
              >
                {preset}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function BuildCard({
  build,
  profile,
  references,
  onBuildChange,
  onProfileChange,
  onDelete,
  onDuplicate,
  onMove,
  canMoveUp,
  canMoveDown,
}: BuildCardProps) {
  const { locale, t } = useI18n();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const displayName = buildDisplayName(build, references, locale);
  const [nameDraft, setNameDraft] = useState(displayName);
  const [scoringOpen, setScoringOpen] = useState(false);

  useEffect(() => {
    setNameDraft(displayName);
  }, [displayName]);

  const setItems = useMemo(
    () =>
      catalogPickerItems(
        "relic-set",
        references,
        locale,
        t("terms.trailblazer")
      ),
    [references, locale, t]
  );
  const cavernSets = useMemo(
    () => setItems.filter((item) => item.tags?.includes("cavern_relic")),
    [setItems]
  );
  const planarSets = useMemo(
    () => setItems.filter((item) => item.tags?.includes("planar_ornament")),
    [setItems]
  );
  const cavernPlan = cavernPlanValue(build);
  const planSets =
    build.category === "cavern"
      ? cavernPlan.flatMap(
          (id) => cavernSets.find((set) => set.id === id) ?? []
        )
      : planarSets.filter((set) => set.id === build.planarSetId);
  const weightedProperties = Object.entries(profile.statWeights)
    .map(([propertyId, weight]) => {
      const name = localizedPropertyName(
        propertyId,
        references.properties,
        locale
      );
      return {
        propertyId,
        weight,
        property: references.properties.propertyById.get(propertyId),
        name,
        compactName: compactPropertyName(propertyId, name, t),
      };
    })
    .sort(
      (left, right) =>
        right.weight - left.weight ||
        (left.property?.display_order ?? 999) -
          (right.property?.display_order ?? 999)
    );
  const visibleWeights = weightedProperties
    .filter(({ weight }) => weight > 0)
    .slice(0, 5);
  // Anything without a chip can be added: unweighted stats and low weights
  // beyond the five shown.
  const unweightedProperties = weightedProperties
    .filter((entry) => !visibleWeights.includes(entry))
    .sort(
      (left, right) =>
        (left.property?.display_order ?? 999) -
        (right.property?.display_order ?? 999)
    );
  const setTriggerSize = isMobile ? "sm" : "lg";

  function setMainStats(
    slot: "body" | "feet" | "planarSphere" | "linkRope",
    values: string[]
  ) {
    if (build.category === "cavern" && (slot === "body" || slot === "feet")) {
      onBuildChange({
        ...build,
        preferredMainStats: { ...build.preferredMainStats, [slot]: values },
      });
    } else if (
      build.category === "planar" &&
      (slot === "planarSphere" || slot === "linkRope")
    ) {
      onBuildChange({
        ...build,
        preferredMainStats: { ...build.preferredMainStats, [slot]: values },
      });
    }
  }

  function setCavernPlan(next: readonly string[]) {
    if (build.category !== "cavern") return;
    const [first, second] = next;
    if (!first) return;
    onBuildChange({
      ...build,
      cavern:
        second && second !== first
          ? { mode: "two-plus-two", setIds: [first, second] }
          : { mode: "four-piece", setId: first },
    });
  }

  function setWeight(propertyId: string, weight: number) {
    onProfileChange({
      ...profile,
      statWeights: { ...profile.statWeights, [propertyId]: weight },
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
    <>
      <article
        className="overflow-hidden rounded-lg border border-border bg-muted/30"
        data-build-card
        data-build-category={build.category}
      >
        <div className="px-2 pt-2 md:px-3">
          <div className="flex min-w-0 items-center gap-1 md:gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t("build.name")}</span>
              <input
                value={nameDraft}
                aria-label={t("build.name")}
                className="h-7 w-full rounded-full border-0 bg-transparent px-2 text-sm font-semibold text-primary outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:px-3 md:text-base"
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => {
                  const nextName = nameDraft.trim();
                  if (nextName && nextName !== displayName)
                    onBuildChange({ ...build, name: nextName });
                  else setNameDraft(displayName);
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
                {onDuplicate && (
                  <DropdownMenuItem onSelect={onDuplicate}>
                    <Copy />
                    {t("build.duplicate")}
                  </DropdownMenuItem>
                )}
                {onMove && (
                  <>
                    <DropdownMenuItem
                      disabled={!canMoveUp}
                      onSelect={() => onMove("up")}
                    >
                      <ArrowUp />
                      {t("build.moveUp")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canMoveDown}
                      onSelect={() => onMove("down")}
                    >
                      <ArrowDown />
                      {t("build.moveDown")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onSelect={() => setScoringOpen(true)}>
                  <SlidersHorizontal />
                  {t("build.scoringConfigure")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
          <div className="border-t border-border pt-1">
            <div className="flex min-w-0 items-center justify-center gap-2 md:gap-3">
              <section
                aria-label={t("build.setPlanTitle")}
                className="flex w-16 shrink-0 flex-col items-center gap-1 md:pl-1"
                data-build-set-plan
              >
                {build.category === "cavern" ? (
                  <CavernPlanPicker
                    value={cavernPlan}
                    items={cavernSets}
                    label={t("build.cavernSet")}
                    triggerSize={setTriggerSize}
                    onChange={setCavernPlan}
                  />
                ) : (
                  <PlanarSetPicker
                    value={build.planarSetId}
                    items={planarSets}
                    label={t("build.planarSet")}
                    triggerSize={setTriggerSize}
                    onChange={(planarSetId) =>
                      onBuildChange({ ...build, planarSetId })
                    }
                  />
                )}
                <SetPlanNames sets={planSets} />
              </section>

              <section className="min-w-0 flex-1 space-y-0.5 md:space-y-1">
                <div className="grid grid-cols-2 gap-1">
                  {BUILD_SLOTS.filter(
                    ([slot]) => slot in build.preferredMainStats
                  ).map(([slot, catalogSlot]) => {
                    const slotDefinition =
                      references.properties.relicSlotById.get(catalogSlot);
                    const validProperties =
                      slotDefinition?.valid_main_properties ?? [];
                    const slotName = localizedName(
                      slotDefinition?.name,
                      locale,
                      slot
                    );
                    return (
                      <div
                        key={slot}
                        className="min-w-0"
                        data-build-slot={slot}
                      >
                        <StatSelect
                          label={slotName}
                          values={buildMainStats(build, slot)}
                          options={validProperties.map((propertyId) => {
                            const label = localizedPropertyName(
                              propertyId,
                              references.properties,
                              locale
                            );
                            return {
                              value: propertyId,
                              label,
                              compactLabel: compactPropertyName(
                                propertyId,
                                label,
                                t
                              ),
                            };
                          })}
                          maxLength={validProperties.length}
                          minimumLength={1}
                          compact={isMobile}
                          addLabel={t("build.addMainStat", { slot: slotName })}
                          deselectLabel={t("build.deselectMainStat")}
                          onValuesChange={(values) =>
                            setMainStats(slot, values)
                          }
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="min-w-0 space-y-0.5" data-build-substats>
                  <div className="flex min-w-0 items-center gap-1">
                    <span
                      className={cn(
                        "truncate font-medium text-muted-foreground select-none",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}
                    >
                      {t("build.substats")}
                    </span>
                    {unweightedProperties.length > 0 && (
                      <LightweightSelect
                        value=""
                        onValueChange={(propertyId) => {
                          if (propertyId) setWeight(propertyId, 1);
                        }}
                      >
                        <LightweightSelectTrigger
                          aria-label={t("build.addSubstat")}
                          className="h-5 w-5 justify-center border-0 bg-primary/5 p-0 text-primary/70 shadow-none transition-transform hover:scale-[1.2] hover:bg-primary/10 hover:text-primary [&>svg]:hidden"
                        >
                          <span className="flex items-center justify-center">
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        </LightweightSelectTrigger>
                        <LightweightSelectContent collisionPadding={8}>
                          {unweightedProperties.map(({ propertyId, name }) => (
                            <LightweightSelectItem
                              key={propertyId}
                              value={propertyId}
                              className="text-sm"
                            >
                              {name}
                            </LightweightSelectItem>
                          ))}
                        </LightweightSelectContent>
                      </LightweightSelect>
                    )}
                  </div>
                  <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-1">
                    {visibleWeights.map(
                      ({ propertyId, weight, name, compactName }) => (
                        <WeightToken
                          key={propertyId}
                          label={t("scoring.weightsTitle")}
                          propertyName={compactName}
                          accessibleName={name}
                          weight={weight}
                          onChange={(nextWeight) =>
                            setWeight(propertyId, nextWeight)
                          }
                        />
                      )
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </article>

      <ResponsiveDialog open={scoringOpen} onOpenChange={setScoringOpen}>
        <ResponsiveDialogContent closeLabel={t("common.close")}>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t("build.scoringConfigure")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("scoring.weightsHelp")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-[minmax(15rem,0.45fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <TextField
                label={t("scoring.profileName")}
                value={profile.name ?? displayName}
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
              {weightedProperties.map(({ propertyId, weight, name }) => (
                <label
                  key={propertyId}
                  className="min-w-0 rounded-lg border border-border bg-background/40 p-2 text-sm"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate">{name}</span>
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
                    aria-label={name}
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
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
