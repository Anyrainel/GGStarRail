import { Lightbulb, LockKeyhole, Star } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AssetImage } from "@/components/shared/AssetImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  characterCatalogName,
  formatAccountStatValue,
  localizedName,
  localizedPropertyName,
} from "@/lib/catalogPresentation";
import type { RelicSlotId } from "@/providers/gilore/types";

const DOMAIN_SLOT_TO_CATALOG = {
  head: "HEAD",
  hands: "HAND",
  body: "BODY",
  feet: "FOOT",
  planarSphere: "NECK",
  linkRope: "OBJECT",
} as const satisfies Record<RelicSlot, RelicSlotId>;

interface CharacterCardProps {
  character: Character;
  lightCone?: LightCone;
  relics: readonly Relic[];
  build?: BuildConfiguration;
  profile?: ScoreProfile;
  references: BuildReferences;
  locale: Locale;
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
  return Array.from(counts, ([id, count]) => ({ id, count })).sort(
    (left, right) => right.count - left.count || left.id.localeCompare(right.id)
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

function scoreBadgeVariant(grade: RelicScore["grade"]) {
  return grade === "S" || grade === "A" ? "default" : "outline";
}

export function CharacterCard({
  character,
  lightCone,
  relics,
  build,
  profile,
  references,
  locale,
}: CharacterCardProps) {
  const { t } = useI18n();
  const definition = references.characters.byId.get(character.definitionId);
  const characterName = definition
    ? characterCatalogName(definition, locale, t("terms.trailblazer"))
    : character.definitionId;
  const path = references.properties.pathById.get(character.pathId);
  const combatType = references.properties.combatTypeById.get(
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

  const renderSetSummary = (
    title: string,
    summaries: readonly SetSummary[]
  ) => (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {summaries.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            {t("characterLoadout.noSet")}
          </span>
        ) : (
          summaries.map(({ id, count }) => (
            <Badge key={id} variant="outline" className="max-w-full gap-1">
              <span className="truncate">
                {localizedName(
                  references.relicSets.byId.get(id)?.name,
                  locale,
                  id
                )}
              </span>
              <span className="shrink-0 tabular-nums">
                {t("characterLoadout.pieceCount", { count })}
              </span>
            </Badge>
          ))
        )}
      </div>
    </div>
  );

  return (
    <Card
      role="article"
      className="min-w-0 overflow-hidden"
      data-character-key={character.key}
      aria-label={t("characterLoadout.cardLabel", { name: characterName })}
    >
      <CardHeader className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-4 space-y-0 sm:grid-cols-[5rem_minmax(0,1fr)_auto]">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-auto w-auto shrink-0 rounded-xl p-0"
        >
          <Link
            to={`${APP_PATHS.archiveCharacters}?character=${encodeURIComponent(character.definitionId)}`}
            aria-label={t("characterLoadout.openArchive", {
              name: characterName,
            })}
          >
            <AssetImage
              kind="character"
              id={definition?.id ?? character.definitionId}
              sourcePath={definition?.icon_path ?? ""}
              alt={characterName}
              className="h-20 w-20 rounded-xl bg-background/70 object-contain"
            />
          </Link>
        </Button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-lg">
                {characterName}
              </CardTitle>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {localizedName(path?.name, locale, character.pathId)} ·{" "}
                {localizedName(
                  combatType?.name,
                  locale,
                  character.combatTypeId
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {definition && (
              <Badge variant="secondary">
                {t("field.rarity", { value: definition.rarity })}
              </Badge>
            )}
            <Badge>{t("field.level", { value: character.level })}</Badge>
            <Badge variant="outline">
              {t("field.eidolon", { value: character.eidolon })}
            </Badge>
          </div>
        </div>
        <div className="col-span-2 rounded-lg border border-border bg-background/55 px-3 py-2 sm:col-span-1 sm:min-w-32 sm:text-right">
          {averageScore === null ? (
            <>
              <p className="text-xs font-medium text-muted-foreground">
                {t("characterLoadout.scoreUnavailable")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("characterLoadout.scoreUnavailableHelp")}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {t("characterLoadout.aggregateScore")}
              </p>
              <p
                className="text-xl font-semibold tabular-nums"
                data-aggregate-score
              >
                {averageScore.toFixed(1)}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {t("characterLoadout.scoredCount", { count: scores.size })}
              </p>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {build && profile && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background/45 px-3 py-2 text-xs">
            <Lightbulb className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="text-muted-foreground">
              {t("characterLoadout.buildTarget", { name: build.name })}
            </span>
          </div>
        )}

        <section
          aria-label={t("characterLoadout.lightCone")}
          className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border bg-background/45 p-3"
        >
          {lightCone ? (
            <AssetImage
              kind="light-cone"
              id={lightConeDefinition?.id ?? lightCone.definitionId}
              sourcePath={lightConeDefinition?.icon_path ?? ""}
              alt={lightConeName}
              className="h-14 w-14 rounded-lg bg-background/70 object-contain"
            />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
              <Star className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {t("characterLoadout.lightCone")}
            </p>
            <p className="truncate text-sm font-semibold">{lightConeName}</p>
            {lightCone && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">
                  {t("field.level", { value: lightCone.level })}
                </Badge>
                <Badge variant="outline">
                  {t("field.superimposition", {
                    value: lightCone.superimposition,
                  })}
                </Badge>
                {lightCone.locked === true && (
                  <Badge variant="outline" className="gap-1">
                    <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                    {t("field.locked")}
                  </Badge>
                )}
                {lightCone.locked === null && (
                  <Badge variant="outline">{t("field.lockUnknown")}</Badge>
                )}
              </div>
            )}
          </div>
        </section>

        <section aria-label={t("characterLoadout.setSummary")}>
          <div className="grid gap-3 rounded-xl border border-border bg-background/45 p-3 sm:grid-cols-2">
            {renderSetSummary(t("characterLoadout.cavernSets"), cavernSets)}
            {renderSetSummary(t("characterLoadout.planarSets"), planarSets)}
          </div>
        </section>

        <section aria-label={t("characterLoadout.relics")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {BUILD_SLOT_ORDER.map((slot) => {
              const relic = relicBySlot.get(slot);
              const slotDefinition = references.properties.relicSlotById.get(
                DOMAIN_SLOT_TO_CATALOG[slot]
              );
              const slotName = localizedName(
                slotDefinition?.name,
                locale,
                slot
              );
              if (!relic) {
                return (
                  <article
                    key={slot}
                    data-relic-slot={slot}
                    aria-label={t("characterLoadout.relicSlotLabel", {
                      slot: slotName,
                    })}
                    className="min-w-0 rounded-lg border border-dashed border-border bg-background/30 p-3"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {slotName}
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t("characterLoadout.emptySlot")}
                    </p>
                  </article>
                );
              }

              const piece = references.relicPieces.byId.get(relic.definitionId);
              const pieceName = localizedName(
                piece?.name,
                locale,
                relic.definitionId
              );
              const mainProperty = references.properties.propertyById.get(
                relic.mainStat.statId
              );
              const score = scores.get(relic.key);
              return (
                <article
                  key={slot}
                  data-relic-slot={slot}
                  aria-label={t("characterLoadout.relicSlotLabel", {
                    slot: slotName,
                  })}
                  className="min-w-0 rounded-lg border border-border bg-background/45 p-3"
                >
                  <div className="flex min-w-0 gap-2.5">
                    <AssetImage
                      kind="relic-piece"
                      id={piece?.id ?? relic.definitionId}
                      sourcePath={piece?.icon_path ?? ""}
                      alt={pieceName}
                      className="h-11 w-11 shrink-0 rounded-md bg-background/70 object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {slotName}
                      </p>
                      <p
                        className="truncate text-sm font-semibold"
                        title={pieceName}
                      >
                        {pieceName}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-border pt-2 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {localizedPropertyName(
                        relic.mainStat.statId,
                        references.properties,
                        locale
                      )}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatAccountStatValue(
                        relic.mainStat.value,
                        mainProperty,
                        locale
                      )}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {score && (
                      <Badge
                        variant={scoreBadgeVariant(score.grade)}
                        className="gap-1 tabular-nums"
                        data-relic-score={relic.key}
                      >
                        {score.grade ?? "—"} {score.total.toFixed(1)}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="tabular-nums">
                      +{relic.level}
                    </Badge>
                    {relic.locked === true && (
                      <Badge variant="outline">{t("field.locked")}</Badge>
                    )}
                    {relic.discarded === true && (
                      <Badge variant="outline">
                        {t("characterLoadout.discardMarked")}
                      </Badge>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
