import { MoreVertical, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatSelect } from "@/components/artifact-builds/StatSelect";
import {
  NumberField,
  TextField,
  ToggleField,
} from "@/components/builds/BuildControls";
import { ItemIcon, type ItemIconSize } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import type { BuildReferences } from "@/lib/buildReferences";
import {
  localizedName,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
import { createRelicSetRarityMap } from "@/lib/relicRarity";
import { cn } from "@/lib/utils";
import type { RelicSlotId } from "@/providers/gilore/types";

const BUILD_SLOTS = [
  ["body", "BODY"],
  ["feet", "FOOT"],
  ["planarSphere", "NECK"],
  ["linkRope", "OBJECT"],
] as const satisfies readonly [
  keyof BuildConfiguration["preferredMainStats"],
  RelicSlotId,
][];

const COMPACT_PROPERTY_KEYS: Readonly<Record<string, MessageKey>> = {
  MaxHP: "stat.short.hp",
  HPDelta: "stat.short.hp",
  HPAddedRatio: "stat.short.hpPercent",
  Attack: "stat.short.atk",
  AttackDelta: "stat.short.atk",
  AttackAddedRatio: "stat.short.atkPercent",
  Defence: "stat.short.def",
  DefenceDelta: "stat.short.def",
  DefenceAddedRatio: "stat.short.defPercent",
  Speed: "stat.short.spd",
  SpeedDelta: "stat.short.spd",
  CriticalChance: "stat.short.critRate",
  CriticalChanceBase: "stat.short.critRate",
  CriticalDamage: "stat.short.critDamage",
  CriticalDamageBase: "stat.short.critDamage",
  BreakDamageAddedRatio: "stat.short.breakEffect",
  BreakDamageAddedRatioBase: "stat.short.breakEffect",
  HealRatio: "stat.short.healing",
  HealRatioBase: "stat.short.healing",
  SPRatio: "stat.short.energyRegen",
  SPRatioBase: "stat.short.energyRegen",
  StatusProbability: "stat.short.effectHit",
  StatusProbabilityBase: "stat.short.effectHit",
  StatusResistance: "stat.short.effectRes",
  StatusResistanceBase: "stat.short.effectRes",
  PhysicalAddedRatio: "stat.short.physicalDamage",
  FireAddedRatio: "stat.short.fireDamage",
  IceAddedRatio: "stat.short.iceDamage",
  ThunderAddedRatio: "stat.short.lightningDamage",
  WindAddedRatio: "stat.short.windDamage",
  QuantumAddedRatio: "stat.short.quantumDamage",
  ImaginaryAddedRatio: "stat.short.imaginaryDamage",
};

function compactPropertyName(
  propertyId: string,
  fallback: string,
  translate: (key: MessageKey) => string
): string {
  const key = COMPACT_PROPERTY_KEYS[propertyId];
  return key ? translate(key) : fallback;
}

interface BuildCardProps {
  build: BuildConfiguration;
  profile: ScoreProfile;
  references: BuildReferences;
  onBuildChange: (build: BuildConfiguration) => void;
  onProfileChange: (profile: ScoreProfile) => void;
  onDelete: () => void;
}

interface SetOption {
  value: string;
  label: string;
  iconPath: string;
  rarity: number | null;
}

interface SetPickerProps {
  label: string;
  pieceCount: 2 | 4;
  iconSize: ItemIconSize;
  mobile: boolean;
  value: string;
  options: readonly SetOption[];
  searchLabel: string;
  emptyLabel: string;
  closeLabel: string;
  onChange: (value: string) => void;
}

function SetPicker({
  label,
  pieceCount,
  iconSize,
  mobile,
  value,
  options,
  searchLabel,
  emptyLabel,
  closeLabel,
  onChange,
}: SetPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const name = selected?.label ?? value;
  const needle = query.trim().toLocaleLowerCase();
  const filteredOptions = options.filter(
    (option) => !needle || option.label.toLocaleLowerCase().includes(needle)
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  }

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  const trigger = (
    <button
      type="button"
      aria-label={`${label}: ${name}`}
      className="group flex w-12 shrink-0 cursor-pointer select-none flex-col items-center gap-1 rounded-lg outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring md:w-16 md:gap-2"
    >
      <ItemIcon
        kind="relic-set"
        id={selected?.value ?? value}
        sourcePath={selected?.iconPath ?? ""}
        alt=""
        aria-hidden="true"
        rarity={selected?.rarity ?? null}
        badge={pieceCount}
        size={iconSize}
      />
      <span className="line-clamp-2 max-w-12 text-center text-[0.65rem] font-medium leading-tight text-foreground md:max-w-16">
        {name}
      </span>
    </button>
  );
  const searchControl = (
    <div className="relative px-3 pb-3">
      <Search
        className="pointer-events-none absolute left-5 top-2.5 h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        value={query}
        aria-label={searchLabel}
        className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") event.stopPropagation();
        }}
      />
    </div>
  );
  const optionContent = (option: SetOption) => (
    <>
      <span
        className={cn(
          "rounded-md",
          option.value === value && "ring-2 ring-primary"
        )}
      >
        <ItemIcon
          kind="relic-set"
          id={option.value}
          sourcePath={option.iconPath}
          alt=""
          aria-hidden="true"
          rarity={option.rarity}
          size="md"
        />
      </span>
      <span className="line-clamp-2 w-full text-[0.62rem] leading-tight">
        {option.label}
      </span>
    </>
  );

  if (mobile) {
    return (
      <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
        <ResponsiveDialogTrigger asChild>{trigger}</ResponsiveDialogTrigger>
        <ResponsiveDialogContent
          closeLabel={closeLabel}
          className="flex h-[85dvh] max-h-[85dvh] flex-col p-0"
        >
          <ResponsiveDialogHeader className="px-4 pb-2 pt-4">
            <ResponsiveDialogTitle>{label}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="sr-only">
              {searchLabel}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {searchControl}
          <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-1 overflow-y-auto border-t border-border p-2">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={option.label}
                aria-current={option.value === value ? "true" : undefined}
                className="flex min-w-0 flex-col items-center gap-1 rounded-md p-1 text-center outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => handleSelect(option.value)}
              >
                {optionContent(option)}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <span className="col-span-full px-2 py-6 text-center text-xs text-muted-foreground">
                {emptyLabel}
              </span>
            )}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        collisionPadding={8}
        side="right"
        className="w-[30rem] max-w-[calc(100vw-1rem)] p-0"
      >
        <DropdownMenuLabel className="px-3 pt-2">{label}</DropdownMenuLabel>
        {searchControl}
        <DropdownMenuSeparator className="my-0" />
        <div className="grid max-h-[32rem] grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-1 overflow-y-auto p-2">
          {filteredOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              aria-label={option.label}
              aria-current={option.value === value ? "true" : undefined}
              className="relative flex min-w-0 flex-col gap-1 p-1 text-center"
              onSelect={() => handleSelect(option.value)}
            >
              {optionContent(option)}
            </DropdownMenuItem>
          ))}
          {filteredOptions.length === 0 && (
            <span className="col-span-full px-2 py-6 text-center text-xs text-muted-foreground">
              {emptyLabel}
            </span>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
    percentage === 100 && "font-bold text-amber-500",
    percentage >= 75 && percentage < 100 && "text-amber-400",
    percentage >= 50 && percentage < 75 && "text-amber-200",
    percentage >= 25 && percentage < 50 && "text-foreground",
    percentage < 25 && "text-muted-foreground"
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${accessibleName}: ${percentage}%`}
          className="flex h-7 max-w-full items-center rounded-md border border-border/60 bg-gradient-select text-xs shadow-sm outline-none transition-all hover:brightness-110 focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="max-w-20 truncate px-2">{propertyName}</span>
          <span className="h-4 w-px shrink-0 bg-white/10" aria-hidden="true" />
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
            <span className="font-mono text-lg font-bold text-amber-100">
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
                    "border-amber-500/50 bg-amber-500/20 text-amber-100"
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
}: BuildCardProps) {
  const { locale, t } = useI18n();
  const useCompactSetIcons = useMediaQuery("(max-width: 767px)");
  const [nameDraft, setNameDraft] = useState(build.name);
  const [scoringOpen, setScoringOpen] = useState(false);

  useEffect(() => {
    setNameDraft(build.name);
  }, [build.name]);

  const setRarityById = useMemo(
    () => createRelicSetRarityMap(references.relicPieces.values),
    [references.relicPieces.values]
  );
  const cavernSets = useMemo(
    () =>
      references.relicSets.values
        .filter((set) => set.kind === "cavern_relic")
        .map((set) => ({
          value: set.id,
          label: localizedName(set.name, locale, set.id),
          iconPath: set.icon_path,
          rarity: setRarityById.get(set.id) ?? null,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    [locale, references.relicSets.values, setRarityById]
  );
  const planarSets = useMemo(
    () =>
      references.relicSets.values
        .filter((set) => set.kind === "planar_ornament")
        .map((set) => ({
          value: set.id,
          label: localizedName(set.name, locale, set.id),
          iconPath: set.icon_path,
          rarity: setRarityById.get(set.id) ?? null,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    [locale, references.relicSets.values, setRarityById]
  );
  const fourPieceSetId =
    build.cavern.mode === "four-piece"
      ? build.cavern.setId
      : build.cavern.setIds[0];
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

  function setMainStats(
    slot: keyof BuildConfiguration["preferredMainStats"],
    values: string[]
  ) {
    onBuildChange({
      ...build,
      preferredMainStats: {
        ...build.preferredMainStats,
        [slot]: values,
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
    <>
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
          <div className="border-t border-border/30 pt-1.5">
            <div className="flex min-w-0 items-start justify-center gap-2 md:gap-3 2xl:gap-2 3xl:gap-3">
              <section
                aria-label={t("build.setPlanTitle")}
                className="flex w-[6.25rem] shrink-0 justify-center gap-1 md:w-[8.25rem]"
              >
                <SetPicker
                  label={t("build.cavernFourPiece")}
                  pieceCount={4}
                  iconSize={useCompactSetIcons ? "sm" : "lg"}
                  mobile={useCompactSetIcons}
                  value={fourPieceSetId}
                  options={cavernSets}
                  searchLabel={`${t("common.search")}: ${t("build.cavernFourPiece")}`}
                  emptyLabel={t("empty.filtered")}
                  closeLabel={t("common.close")}
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
                  iconSize={useCompactSetIcons ? "sm" : "lg"}
                  mobile={useCompactSetIcons}
                  value={build.planarSetId}
                  options={planarSets}
                  searchLabel={`${t("common.search")}: ${t("build.planarTwoPiece")}`}
                  emptyLabel={t("empty.filtered")}
                  closeLabel={t("common.close")}
                  onChange={(planarSetId) =>
                    onBuildChange({ ...build, planarSetId })
                  }
                />
              </section>

              <section className="min-w-0 flex-1 space-y-1">
                <div className="grid grid-cols-2 gap-1 xl:grid-cols-4 xl:gap-1.5 2xl:grid-cols-2 2xl:gap-1 3xl:grid-cols-4 3xl:gap-1.5">
                  {BUILD_SLOTS.map(([slot, catalogSlot]) => {
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
                      <div key={slot} data-build-slot={slot}>
                        <StatSelect
                          label={slotName}
                          values={build.preferredMainStats[slot]}
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
                          maxLength={3}
                          minimumLength={1}
                          compact={useCompactSetIcons}
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

                <div className="flex min-h-7 min-w-0 flex-wrap items-center gap-1">
                  <span className="shrink-0 text-[0.62rem] font-medium text-muted-foreground md:text-xs">
                    {t("scoring.weightsTitle")}
                  </span>
                  {weightedProperties
                    .filter(({ weight }) => weight > 0)
                    .slice(0, 5)
                    .map(({ propertyId, weight, name, compactName }) => (
                      <WeightToken
                        key={propertyId}
                        label={t("scoring.weightsTitle")}
                        propertyName={compactName}
                        accessibleName={name}
                        weight={weight}
                        onChange={(nextWeight) =>
                          onProfileChange({
                            ...profile,
                            statWeights: {
                              ...profile.statWeights,
                              [propertyId]: nextWeight,
                            },
                          })
                        }
                      />
                    ))}
                </div>
              </section>
            </div>

            {build.cavern.mode === "two-plus-two" && (
              <p className="mt-1.5 rounded-md border border-border bg-background/40 p-1.5 text-xs leading-5 text-muted-foreground">
                {t("build.legacyTwoPlusTwo")}
              </p>
            )}
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
