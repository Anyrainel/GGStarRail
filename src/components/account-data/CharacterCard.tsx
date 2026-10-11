import { CircleAlert, Star } from "lucide-react";
import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { RelicStatDisplay } from "@/components/account-data/RelicStatDisplay";
import { AssetImage } from "@/components/shared/AssetImage";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { CharacterBadgeGroup } from "@/components/shared/CharacterBadgeGroup";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { RelicSlotGrid } from "@/components/shared/relic/RelicSlotGrid";
import { Card, CardContent } from "@/components/ui/card";
import { APP_PATHS } from "@/config/navigation";
import {
  type Character,
  type LightCone,
  type Relic,
  relicCategory,
} from "@/domain/account/schemas";
import { type AbilityTraceKind, abilityTraceId } from "@/domain/account/traces";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import { type RelicScore, scoreRelic } from "@/domain/build/scoring";
import { eidolonLevelBonuses } from "@/domain/combat/kit/skillLevels";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useI18n } from "@/i18n/I18nContext";
import type { Locale } from "@/i18n/locales";
import type { MessageKey } from "@/i18n/messages.en";
import { buildDisplayName } from "@/lib/buildPresentation";
import {
  type BuildReferences,
  createRelicScoringContext,
} from "@/lib/buildReferences";
import { characterCatalogName, localizedName } from "@/lib/catalogPresentation";
import {
  type EquippedSetBonus,
  equippedSetSummary,
  type RelicKind,
} from "@/lib/relicPresentation";
import { createRelicSetRarityMap } from "@/lib/relicRarity";
import { cn } from "@/lib/utils";
import type { CharacterDefinition } from "@/providers/reference/types";

/** Computed once by CharacterView so every card shares the same density. */
export interface CardLayout {
  isMobile: boolean;
  isVeryNarrow: boolean;
  isRelicCompact: boolean;
}

const DEFAULT_LAYOUT: CardLayout = {
  isMobile: false,
  isVeryNarrow: false,
  isRelicCompact: false,
};

interface CharacterCardProps {
  character: Character;
  lightCone?: LightCone;
  relics: readonly Relic[];
  builds: readonly BuildConfiguration[];
  profiles: ReadonlyMap<string, ScoreProfile>;
  references: BuildReferences;
  locale: Locale;
  layout?: CardLayout;
}

type LeveledTrace = Exclude<AbilityTraceKind, "technique">;

const TRACE_LABELS: Readonly<
  Record<
    LeveledTrace,
    { full: MessageKey; short: MessageKey; name: MessageKey }
  >
> = {
  basic: {
    full: "characterLoadout.trace.basic",
    short: "characterLoadout.traceShort.basic",
    name: "combat.origin.basic",
  },
  skill: {
    full: "characterLoadout.trace.skill",
    short: "characterLoadout.traceShort.skill",
    name: "combat.origin.skill",
  },
  ultimate: {
    full: "characterLoadout.trace.ultimate",
    short: "characterLoadout.traceShort.ultimate",
    name: "combat.origin.ultimate",
  },
  talent: {
    full: "characterLoadout.trace.talent",
    short: "characterLoadout.traceShort.talent",
    name: "combat.origin.talent",
  },
  memospriteSkill: {
    full: "characterLoadout.trace.memospriteSkill",
    short: "characterLoadout.traceShort.memospriteSkill",
    name: "combat.origin.memospriteSkill",
  },
  memospriteTalent: {
    full: "characterLoadout.trace.memospriteTalent",
    short: "characterLoadout.traceShort.memospriteTalent",
    name: "combat.origin.memospriteTalent",
  },
  elationSkill: {
    full: "characterLoadout.trace.elationSkill",
    short: "characterLoadout.traceShort.elationSkill",
    name: "combat.origin.elationSkill",
  },
};

const TRACE_ORDER = Object.keys(TRACE_LABELS) as LeveledTrace[];

interface TraceLevel {
  kind: LeveledTrace;
  level: number;
  bonus: number;
}

/**
 * Reported ability levels with the Eidolon bonus shown separately. Abilities
 * the catalog lacks (Memosprite, Elation) or the source did not report are
 * left out.
 */
function traceLevels(
  character: Character,
  definition: CharacterDefinition
): TraceLevel[] {
  const bonuses = eidolonLevelBonuses(definition, character.eidolon);
  const catalogTraces = new Set(definition.traces.map((trace) => trace.id));
  return TRACE_ORDER.flatMap((kind) => {
    const id = abilityTraceId(definition.id, kind);
    const level = character.traces[id];
    if (!catalogTraces.has(id) || level === undefined || level < 1) return [];
    return [{ kind, level, bonus: bonuses[kind] }];
  });
}

function scoreLoadout(
  relics: readonly Relic[],
  builds: readonly BuildConfiguration[],
  profiles: ReadonlyMap<string, ScoreProfile>,
  references: BuildReferences
): ReadonlyMap<string, RelicScore> {
  const context = createRelicScoringContext(references);
  const scores = new Map<string, RelicScore>();
  for (const relic of relics) {
    const build = builds.find(
      (build) =>
        build.category === relicCategory(relic.slot) &&
        profiles.has(build.scoreProfileId)
    );
    const profile = build ? profiles.get(build.scoreProfileId) : undefined;
    if (!build || !profile) continue;
    if (
      !references.relicPieces.byId.has(relic.definitionId) ||
      !references.properties.propertyById.has(relic.mainStat.statId)
    ) {
      continue;
    }
    scores.set(relic.key, scoreRelic(relic, profile, context, build));
  }
  return scores;
}

/**
 * The set row paints one band across the Cavern cell, the divider column and
 * the Planar cell so it reads as GGArtifact's set strip.
 */
const SET_BAND_CLASS =
  "[&>[data-relic-group-header]]:border-b [&>[data-relic-group-header]]:border-border [&>[data-relic-group-header]]:bg-black/20 [&>[data-relic-group-header=cavern]+div]:border-b [&>[data-relic-group-header=cavern]+div]:border-border [&>[data-relic-group-header=cavern]+div]:bg-black/20";
/**
 * Faint lines between neighbouring slots of one group; the group divider
 * between Cavern Relics and Planar Ornaments stays the stronger line.
 */
const SLOT_SEPARATOR_CLASS =
  "[&>[data-relic-slot]+[data-relic-slot]]:border-l [&>[data-relic-slot]+[data-relic-slot]]:border-secondary";
/** Stacked, only the Cavern row leads the card; the Planar chip sits beside its slots. */
const STACKED_SET_BAND_CLASS =
  "[&>[data-relic-group-header=cavern]]:border-b [&>[data-relic-group-header=cavern]]:border-border [&>[data-relic-group-header=cavern]]:bg-black/20";

function CharacterCardComponent({
  character,
  lightCone,
  relics,
  builds,
  profiles,
  references,
  locale,
  layout = DEFAULT_LAYOUT,
}: CharacterCardProps) {
  const { t } = useI18n();
  const { isMobile, isVeryNarrow, isRelicCompact } = layout;
  const targetName = (["cavern", "planar"] as const)
    .flatMap((category) => {
      const build = builds.find(
        (build) =>
          build.category === category && profiles.has(build.scoreProfileId)
      );
      return build ? [buildDisplayName(build, references, locale)] : [];
    })
    .join(" + ");
  const definition = references.characters.byId.get(character.definitionId);
  const characterName = definition
    ? characterCatalogName(definition, locale, t("terms.trailblazer"))
    : character.definitionId;
  const combatType = references.properties.combatTypeById.get(
    character.combatTypeId
  );
  const combatTypeName = localizedName(
    combatType?.name,
    locale,
    character.combatTypeId
  );
  const lightConeDefinition = lightCone
    ? references.lightCones.byId.get(lightCone.definitionId)
    : undefined;
  const lightConeName = lightCone
    ? localizedName(lightConeDefinition?.name, locale, lightCone.definitionId)
    : t("characterLoadout.noLightCone");
  const relicBySlot = new Map(relics.map((relic) => [relic.slot, relic]));
  const sets = useMemo(() => equippedSetSummary(relics), [relics]);
  const setRarityById = useMemo(
    () => createRelicSetRarityMap(references.relicPieces.values),
    [references.relicPieces.values]
  );
  const scores = useMemo(
    () => scoreLoadout(relics, builds, profiles, references),
    [builds, profiles, references, relics]
  );
  const traces = useMemo(
    () => (definition ? traceLevels(character, definition) : []),
    [character, definition]
  );
  const averageScore = useMemo(() => {
    if (scores.size === 0) return null;
    return (
      Array.from(scores.values()).reduce(
        (total, score) => total + score.total,
        0
      ) / scores.size
    );
  }, [scores]);

  const characterIconLabel = [
    characterName,
    definition ? t("field.rarity", { value: definition.rarity }) : null,
    t("field.level", { value: character.level }),
    t("field.eidolon", { value: character.eidolon }),
  ]
    .filter(Boolean)
    .join(", ");
  const lightConeIconLabel = lightCone
    ? [
        lightConeName,
        lightConeDefinition
          ? t("field.rarity", { value: lightConeDefinition.rarity })
          : null,
        t("field.level", { value: lightCone.level }),
        t("field.superimposition", { value: lightCone.superimposition }),
        lightCone.locked === true
          ? t("field.locked")
          : lightCone.locked === null
            ? t("field.lockUnknown")
            : null,
      ]
        .filter(Boolean)
        .join(", ")
    : lightConeName;
  const iconSize = isVeryNarrow ? "md" : "lg";

  const setChip = (
    bonus: EquippedSetBonus,
    kind: RelicKind,
    iconOnly: boolean
  ) => {
    const setDefinition = references.relicSets.byId.get(bonus.setId);
    const setName = localizedName(setDefinition?.name, locale, bonus.setId);
    const tier = t("characterLoadout.tier", { count: bonus.tier });
    return (
      <CatalogHoverCard
        key={bonus.setId}
        kind="relic-set"
        id={bonus.setId}
        disabled={!setDefinition}
      >
        <li
          className={cn(
            "flex min-w-0 items-center gap-2",
            !iconOnly && "flex-1"
          )}
          // The hover card shows the set; the title is the fallback.
          title={setDefinition ? undefined : `${setName} · ${tier}`}
          data-set-bonus={bonus.tier}
          data-relic-kind={kind}
        >
          <ItemIcon
            kind="relic-set"
            id={setDefinition?.id ?? bonus.setId}
            sourcePath={setDefinition?.icon_path ?? ""}
            alt={`${setName}, ${tier}`}
            rarity={setRarityById.get(bonus.setId) ?? null}
            badge={iconOnly ? bonus.tier : undefined}
            size={isVeryNarrow ? "xs" : "sm"}
            tabIndex={setDefinition ? 0 : undefined}
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {!iconOnly && (
            <span className="min-w-0 leading-tight" aria-hidden="true">
              <span
                className={cn(
                  "block truncate font-semibold text-foreground",
                  isVeryNarrow ? "text-xs" : "text-sm md:text-base"
                )}
              >
                {setName}
              </span>
              <span
                className={cn(
                  "block font-mono text-muted-foreground",
                  isVeryNarrow ? "text-[10px]" : "text-xs"
                )}
              >
                {tier}
              </span>
            </span>
          )}
        </li>
      </CatalogHoverCard>
    );
  };

  const noSetBonus = (
    <li
      className={cn(
        "truncate italic text-muted-foreground",
        isVeryNarrow ? "text-xs" : "text-sm"
      )}
    >
      {t("characterLoadout.noSetBonus")}
    </li>
  );

  const scoreBlock = (
    <div
      className="shrink-0 text-right"
      title={
        targetName
          ? t("characterLoadout.buildTarget", { name: targetName })
          : t("characterLoadout.scoreUnavailableHelp")
      }
      data-score-block
    >
      {averageScore === null ? (
        <div className="flex items-center gap-1 text-amber-300">
          <CircleAlert
            className={isVeryNarrow ? "h-4 w-4" : "h-5 w-5"}
            aria-label={t("characterLoadout.scoreUnavailable")}
          />
          {!isMobile && (
            <span
              className="max-w-24 text-left text-[10px] leading-tight text-muted-foreground"
              aria-hidden="true"
            >
              {t("characterLoadout.scoreUnavailable")}
            </span>
          )}
        </div>
      ) : (
        <>
          <div
            className={cn(
              "whitespace-nowrap font-bold leading-tight text-muted-foreground",
              isVeryNarrow ? "text-[10px]" : "text-xs md:text-sm"
            )}
          >
            <span aria-hidden="true">
              {t("characterLoadout.averageScoreShort")}
            </span>
            <span className="sr-only">
              {t("characterLoadout.aggregateScore")}
            </span>
          </div>
          <div
            className={cn(
              "bg-gradient-to-br from-amber-100 via-orange-300 to-amber-500 bg-clip-text pr-0.5 font-black italic leading-none tracking-tighter text-transparent",
              isVeryNarrow ? "text-xl" : "text-2xl"
            )}
            data-aggregate-score
          >
            {averageScore.toFixed(1)}
          </div>
          <span className="sr-only">
            {targetName
              ? t("characterLoadout.buildTarget", { name: targetName })
              : t("characterLoadout.scoredCount", {
                  count: scores.size,
                })}
          </span>
        </>
      )}
    </div>
  );

  const cavernHeader = (
    <ul
      aria-label={t("characterLoadout.cavernSets")}
      className={cn(
        "flex h-full min-w-0 items-center",
        isVeryNarrow ? "min-h-12 gap-2 px-1.5" : "min-h-14 gap-4 px-3"
      )}
    >
      {sets.cavern.length === 0
        ? noSetBonus
        : sets.cavern.map((bonus) => setChip(bonus, "cavern", false))}
    </ul>
  );
  const planarHeader = (
    <ul
      aria-label={t("characterLoadout.planarSets")}
      className={cn(
        "flex h-full min-w-0 items-center",
        isVeryNarrow ? "justify-center gap-2 px-1" : "min-h-14 gap-4 px-3"
      )}
    >
      {sets.planar
        ? setChip(sets.planar, "planar", isVeryNarrow)
        : isVeryNarrow
          ? null
          : noSetBonus}
    </ul>
  );
  const planarCell = isVeryNarrow ? (
    <div className="flex h-full min-w-0 items-center justify-evenly gap-1">
      {planarHeader}
      {scoreBlock}
    </div>
  ) : (
    planarHeader
  );

  return (
    <Card
      role="article"
      className="mx-auto flex h-full w-full max-w-4xl min-w-0 flex-col overflow-hidden border-border bg-gradient-card transition-colors"
      data-character-key={character.key}
      aria-label={t("characterLoadout.cardLabel", { name: characterName })}
    >
      <header
        className={cn(
          "flex flex-col gap-2 border-b border-border bg-gradient-select",
          isVeryNarrow ? "p-1.5" : "p-3"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center",
            isVeryNarrow ? "gap-2" : "gap-3"
          )}
          data-character-equipment-row
        >
          <CatalogHoverCard
            kind="character"
            id={character.definitionId}
            disabled={!definition}
          >
            <Link
              to={`${APP_PATHS.archiveCharacters}?character=${encodeURIComponent(character.definitionId)}`}
              aria-label={t("characterLoadout.openArchive", {
                name: characterName,
              })}
              className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ItemIcon
                kind="character"
                id={definition?.id ?? character.definitionId}
                sourcePath={definition?.icon_path ?? ""}
                alt={characterIconLabel}
                rarity={definition?.rarity ?? null}
                badge={character.eidolon}
                level={`Lv. ${character.level}`}
                cornerAsset={
                  combatType
                    ? {
                        kind: "combat-type",
                        id: combatType.id,
                        sourcePath: combatType.icon_path,
                        alt: combatTypeName,
                      }
                    : undefined
                }
                size={iconSize}
              />
            </Link>
          </CatalogHoverCard>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <h3
                className={cn(
                  "min-w-0 max-w-full truncate font-bold text-foreground",
                  isVeryNarrow ? "text-base" : "text-lg md:text-xl"
                )}
              >
                {characterName}
              </h3>
              {!isVeryNarrow && traces.length > 0 && (
                <p
                  className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground"
                  data-trace-levels
                >
                  {traces.map(({ kind, level, bonus }) => (
                    <span
                      key={kind}
                      className="whitespace-nowrap"
                      title={t(TRACE_LABELS[kind].name)}
                      data-trace={kind}
                    >
                      {t(
                        isMobile
                          ? TRACE_LABELS[kind].short
                          : TRACE_LABELS[kind].full
                      )}{" "}
                      <span className="text-foreground/90">
                        {level}
                        {bonus > 0 && `+${bonus}`}
                      </span>
                    </span>
                  ))}
                </p>
              )}
            </div>
            {definition ? (
              <CharacterBadgeGroup
                character={definition}
                properties={references.properties}
              />
            ) : (
              <FallbackBadges
                character={character}
                references={references}
                locale={locale}
              />
            )}
          </div>

          {!isVeryNarrow && scoreBlock}

          <section
            aria-label={t("characterLoadout.lightCone")}
            className="shrink-0"
            // The hover card shows the Light Cone; the title is the fallback.
            title={lightConeDefinition ? undefined : lightConeIconLabel}
          >
            {lightCone ? (
              <CatalogHoverCard
                kind="light-cone"
                id={lightCone.definitionId}
                disabled={!lightConeDefinition}
              >
                <ItemIcon
                  kind="light-cone"
                  id={lightConeDefinition?.id ?? lightCone.definitionId}
                  sourcePath={lightConeDefinition?.icon_path ?? ""}
                  alt={lightConeIconLabel}
                  rarity={lightConeDefinition?.rarity ?? null}
                  badge={lightCone.superimposition}
                  level={`Lv. ${lightCone.level}`}
                  locked={lightCone.locked}
                  size={iconSize}
                  tabIndex={lightConeDefinition ? 0 : undefined}
                  className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </CatalogHoverCard>
            ) : (
              <div
                role="img"
                aria-label={lightConeName}
                className={cn(
                  "grid shrink-0 place-items-center rounded-lg border-2 border-dashed border-border bg-black/30 text-muted-foreground",
                  isVeryNarrow ? "h-14 w-14" : "h-16 w-16"
                )}
              >
                <Star className="h-5 w-5" aria-hidden="true" />
              </div>
            )}
          </section>
        </div>
      </header>

      <CardContent className="flex-1 bg-black/10 p-0">
        <section
          aria-label={t("characterLoadout.relics")}
          className="h-full"
          data-relic-loadout
        >
          <RelicSlotGrid
            layout={isVeryNarrow ? "stacked" : "row"}
            className={cn(
              "h-full items-stretch gap-0 md:gap-0 lg:gap-0",
              SLOT_SEPARATOR_CLASS,
              isVeryNarrow ? STACKED_SET_BAND_CLASS : SET_BAND_CLASS
            )}
            header={{ cavern: cavernHeader, planar: planarCell }}
            renderSlot={(slot) => {
              const relic = relicBySlot.get(slot);
              const slotDefinition = references.properties.relicSlotById.get(
                CATALOG_RELIC_SLOT[slot]
              );
              const slotName = localizedName(
                slotDefinition?.name,
                locale,
                slot
              );
              if (!relic) {
                return (
                  <article
                    aria-label={t("characterLoadout.relicSlotLabel", {
                      slot: slotName,
                    })}
                    className={cn(
                      "flex w-full min-w-0 flex-col items-center justify-center gap-1 text-center text-muted-foreground",
                      isRelicCompact
                        ? "min-h-[6.25rem] p-1 text-[10px] md:text-xs"
                        : "min-h-[8.5rem] p-2 text-sm"
                    )}
                    data-relic-empty
                  >
                    <span className="font-medium">{slotName}</span>
                    <span>{t("characterLoadout.emptySlot")}</span>
                  </article>
                );
              }
              return (
                <RelicStatDisplay
                  relic={relic}
                  score={scores.get(relic.key)}
                  references={references}
                  locale={locale}
                  slotName={slotName}
                  compact={isRelicCompact}
                />
              );
            }}
          />
        </section>
      </CardContent>
    </Card>
  );
}

/** Path and Combat Type chips for a Character the catalog no longer lists. */
function FallbackBadges({
  character,
  references,
  locale,
}: {
  character: Character;
  references: BuildReferences;
  locale: Locale;
}) {
  const path = references.properties.pathById.get(character.pathId);
  const combatType = references.properties.combatTypeById.get(
    character.combatTypeId
  );
  const chips = [
    {
      key: "combat-type" as const,
      asset: combatType,
      name: localizedName(combatType?.name, locale, character.combatTypeId),
    },
    {
      key: "path" as const,
      asset: path,
      name: localizedName(path?.name, locale, character.pathId),
    },
  ];
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 md:gap-2">
      {chips.map(({ key, asset, name }) => (
        <span
          key={key}
          className="flex min-w-0 items-center gap-1 rounded-full border-2 border-current px-1.5 py-0 text-xs text-muted-foreground md:px-2.5 md:py-0.5 md:text-sm"
        >
          {asset && (
            <AssetImage
              kind={key}
              id={asset.id}
              sourcePath={asset.icon_path}
              alt=""
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 object-contain md:h-5 md:w-5"
            />
          )}
          <span className="truncate">{name}</span>
        </span>
      ))}
    </div>
  );
}

export const CharacterCard = memo(CharacterCardComponent);
