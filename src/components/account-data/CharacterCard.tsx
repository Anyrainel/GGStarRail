import { CircleAlert, Star } from "lucide-react";
import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { RelicStatDisplay } from "@/components/account-data/RelicStatDisplay";
import { AssetImage } from "@/components/shared/AssetImage";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Card, CardContent } from "@/components/ui/card";
import { APP_PATHS } from "@/config/navigation";
import {
  type Character,
  type LightCone,
  type Relic,
  type RelicSlot,
  relicCategory,
} from "@/domain/account/schemas";
import { BUILD_SLOT_ORDER } from "@/domain/build/evaluation";
import type { BuildConfiguration, ScoreProfile } from "@/domain/build/schemas";
import { type RelicScore, scoreRelic } from "@/domain/build/scoring";
import { useI18n } from "@/i18n/I18nContext";
import type { Locale } from "@/i18n/locales";
import {
  type BuildReferences,
  createRelicScoringContext,
} from "@/lib/buildReferences";
import { characterCatalogName, localizedName } from "@/lib/catalogPresentation";
import { cn } from "@/lib/utils";
import type { RelicSlotId } from "@/providers/gilore/types";

const DOMAIN_SLOT_TO_CATALOG = {
  head: "HEAD",
  hands: "HAND",
  body: "BODY",
  feet: "FOOT",
  planarSphere: "NECK",
  linkRope: "OBJECT",
} as const satisfies Record<RelicSlot, RelicSlotId>;

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
  build?: BuildConfiguration;
  profile?: ScoreProfile;
  references: BuildReferences;
  locale: Locale;
  layout?: CardLayout;
}

interface SetSummary {
  id: string;
  count: number;
}

function summarizeSets(
  relics: readonly Relic[],
  category: "cavern" | "planar"
): SetSummary[] {
  const counts = new Map<string, number>();
  for (const relic of relics) {
    if (relicCategory(relic.slot) !== category) continue;
    counts.set(relic.setId, (counts.get(relic.setId) ?? 0) + 1);
  }
  return Array.from(counts, ([id, count]) => ({ id, count }))
    .filter(({ count }) => count >= 2)
    .sort(
      (left, right) =>
        right.count - left.count || left.id.localeCompare(right.id)
    );
}

function scoreLoadout(
  relics: readonly Relic[],
  build: BuildConfiguration | undefined,
  profile: ScoreProfile | undefined,
  references: BuildReferences
): ReadonlyMap<string, RelicScore> {
  if (!build || !profile) return new Map();
  const context = createRelicScoringContext(references);
  const scores = new Map<string, RelicScore>();
  for (const relic of relics) {
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

function CharacterCardComponent({
  character,
  lightCone,
  relics,
  build,
  profile,
  references,
  locale,
  layout = DEFAULT_LAYOUT,
}: CharacterCardProps) {
  const { t } = useI18n();
  const { isMobile, isVeryNarrow, isRelicCompact } = layout;
  const compact = isVeryNarrow || isRelicCompact;
  const definition = references.characters.byId.get(character.definitionId);
  const characterName = definition
    ? characterCatalogName(definition, locale, t("terms.trailblazer"))
    : character.definitionId;
  const path = references.properties.pathById.get(character.pathId);
  const combatType = references.properties.combatTypeById.get(
    character.combatTypeId
  );
  const pathName = localizedName(path?.name, locale, character.pathId);
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
  const cavernSets = useMemo(() => summarizeSets(relics, "cavern"), [relics]);
  const planarSets = useMemo(() => summarizeSets(relics, "planar"), [relics]);
  const scores = useMemo(
    () => scoreLoadout(relics, build, profile, references),
    [build, profile, references, relics]
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

  const renderSetGroup = (title: string, summaries: readonly SetSummary[]) => (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="sr-only">{title}</span>
      {summaries.length === 0 ? (
        <span className="truncate text-xs italic text-muted-foreground">
          {t("characterLoadout.noSet")}
        </span>
      ) : (
        summaries.map(({ id, count }) => {
          const setDefinition = references.relicSets.byId.get(id);
          const setName = localizedName(setDefinition?.name, locale, id);
          const pieceCount = t("characterLoadout.pieceCount", { count });
          return (
            <div key={id} className="flex min-w-0 items-center gap-2">
              <ItemIcon
                kind="relic-set"
                id={setDefinition?.id ?? id}
                sourcePath={setDefinition?.icon_path ?? ""}
                alt={`${setName}, ${pieceCount}`}
                rarity={5}
                badge={count}
                size={compact ? "sm" : "md"}
              />
              <span className="min-w-0 leading-tight">
                <span
                  className={cn(
                    "block max-w-40 truncate font-semibold",
                    compact ? "text-[10px]" : "text-xs"
                  )}
                  title={setName}
                >
                  {setName}
                </span>
                <span
                  className={cn(
                    "block font-mono text-muted-foreground",
                    compact ? "text-[9px]" : "text-[11px]"
                  )}
                >
                  {pieceCount}
                </span>
              </span>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <Card
      role="article"
      className="mx-auto flex h-full w-full max-w-3xl min-w-0 flex-col overflow-hidden border-border/50 bg-gradient-card transition-colors"
      data-character-key={character.key}
      aria-label={t("characterLoadout.cardLabel", { name: characterName })}
    >
      <header
        className={cn(
          "flex flex-col border-b border-border/40 bg-gradient-select",
          compact ? "gap-1.5 p-1.5" : "gap-2 p-3"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center",
            compact ? "gap-2" : "gap-3"
          )}
          data-character-equipment-row
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
              rarity={definition?.rarity ?? 1}
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
              size={compact ? "md" : "lg"}
            />
          </Link>

          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                "truncate font-bold text-foreground",
                compact ? "text-base" : "text-xl"
              )}
            >
              {characterName}
            </h3>
            <div
              className={cn(
                "mt-1 flex min-w-0 flex-wrap items-center",
                compact ? "gap-1" : "gap-1.5"
              )}
            >
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1 rounded-full border border-border bg-background/40 px-1.5 py-0.5 text-muted-foreground",
                  compact ? "text-[10px]" : "text-xs"
                )}
              >
                {path && (
                  <AssetImage
                    kind="path"
                    id={path.id}
                    sourcePath={path.icon_path}
                    alt=""
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 object-contain"
                  />
                )}
                <span className="truncate">{pathName}</span>
              </span>
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1 rounded-full border border-border bg-background/40 px-1.5 py-0.5 text-muted-foreground",
                  compact ? "text-[10px]" : "text-xs"
                )}
              >
                {combatType && (
                  <AssetImage
                    kind="combat-type"
                    id={combatType.id}
                    sourcePath={combatType.icon_path}
                    alt=""
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 object-contain"
                  />
                )}
                <span className="truncate">{combatTypeName}</span>
              </span>
            </div>
          </div>

          <section
            aria-label={t("characterLoadout.lightCone")}
            className="shrink-0"
            title={lightConeIconLabel}
          >
            {lightCone ? (
              <ItemIcon
                kind="light-cone"
                id={lightConeDefinition?.id ?? lightCone.definitionId}
                sourcePath={lightConeDefinition?.icon_path ?? ""}
                alt={lightConeIconLabel}
                rarity={lightConeDefinition?.rarity ?? 1}
                badge={lightCone.superimposition}
                level={`Lv. ${lightCone.level}`}
                locked={lightCone.locked}
                size={compact ? "md" : "lg"}
              />
            ) : (
              <div
                role="img"
                aria-label={lightConeName}
                className={cn(
                  "grid shrink-0 place-items-center rounded-lg border-2 border-dashed border-border bg-black/30 text-muted-foreground",
                  compact ? "h-14 w-14" : "h-16 w-16"
                )}
              >
                <Star className="h-5 w-5" aria-hidden="true" />
              </div>
            )}
          </section>
        </div>
      </header>

      <section
        aria-label={t("characterLoadout.setSummary")}
        className={cn(
          "flex min-w-0 items-center overflow-hidden border-b border-border/30 bg-black/20",
          compact ? "min-h-12 gap-2 px-1.5" : "min-h-14 gap-3 px-4"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          {renderSetGroup(t("characterLoadout.cavernSets"), cavernSets)}
          {renderSetGroup(t("characterLoadout.planarSets"), planarSets)}
        </div>

        <div
          className={cn(
            "ml-auto shrink-0 border-l border-border/40 text-right",
            compact ? "pl-2" : "pl-3"
          )}
          title={
            build
              ? t("characterLoadout.buildTarget", { name: build.name })
              : t("characterLoadout.scoreUnavailableHelp")
          }
        >
          {averageScore === null ? (
            <div className="flex items-center gap-1 text-amber-300">
              <CircleAlert
                className={compact ? "h-4 w-4" : "h-5 w-5"}
                aria-hidden="true"
              />
              {!compact && (
                <span className="max-w-24 text-left text-[10px] leading-tight text-muted-foreground">
                  {t("characterLoadout.scoreUnavailable")}
                </span>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-end gap-1">
                <span
                  className={cn(
                    "font-bold leading-none text-muted-foreground",
                    compact ? "text-[9px]" : "text-xs"
                  )}
                >
                  {t("characterLoadout.aggregateScore")}
                </span>
                <span
                  className={cn(
                    "bg-gradient-to-br from-amber-100 via-orange-300 to-amber-500 bg-clip-text font-black italic leading-none tracking-tighter text-transparent",
                    compact ? "text-xl" : "text-2xl"
                  )}
                  data-aggregate-score
                >
                  {averageScore.toFixed(1)}
                </span>
              </div>
              <p
                className={cn(
                  "mt-1 max-w-40 truncate text-muted-foreground",
                  isMobile || compact ? "text-[9px]" : "text-[10px]"
                )}
              >
                {build
                  ? t("characterLoadout.buildTarget", { name: build.name })
                  : t("characterLoadout.scoredCount", { count: scores.size })}
              </p>
            </>
          )}
        </div>
      </section>

      <CardContent className="flex-1 bg-black/10 p-0">
        <section
          aria-label={t("characterLoadout.relics")}
          className="grid h-full grid-cols-6 divide-x divide-border/30 px-0.5"
        >
          {BUILD_SLOT_ORDER.map((slot) => {
            const relic = relicBySlot.get(slot);
            const slotDefinition = references.properties.relicSlotById.get(
              DOMAIN_SLOT_TO_CATALOG[slot]
            );
            const slotName = localizedName(slotDefinition?.name, locale, slot);
            if (!relic) {
              return (
                <article
                  key={slot}
                  data-relic-slot={slot}
                  aria-label={t("characterLoadout.relicSlotLabel", {
                    slot: slotName,
                  })}
                  className={cn(
                    "flex min-w-0 flex-col items-center justify-center gap-1 text-center text-muted-foreground",
                    isRelicCompact ? "min-h-28 p-1" : "min-h-36 p-2"
                  )}
                >
                  <span
                    className={cn(
                      "font-medium",
                      isRelicCompact ? "text-[10px]" : "text-xs"
                    )}
                  >
                    {slotName}
                  </span>
                  <span className={isRelicCompact ? "text-[9px]" : "text-xs"}>
                    {t("characterLoadout.emptySlot")}
                  </span>
                </article>
              );
            }

            return (
              <RelicStatDisplay
                key={slot}
                relic={relic}
                score={scores.get(relic.key)}
                references={references}
                locale={locale}
                slotName={slotName}
                compact={isRelicCompact}
              />
            );
          })}
        </section>
      </CardContent>
    </Card>
  );
}

export const CharacterCard = memo(CharacterCardComponent);
