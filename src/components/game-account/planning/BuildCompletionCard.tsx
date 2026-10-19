import { ArrowRight, Check, CircleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { AssetImage } from "@/components/shared/AssetImage";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { RelicKindIcon } from "@/components/shared/relic/RelicKindIcon";
import { Button } from "@/components/ui/button";
import { APP_PATHS } from "@/config/navigation";
import type {
  BuildCompletion,
  CompletionStatus,
} from "@/domain/build/completion";
import type { AccountSnapshot } from "@/domain/game-account/schemas";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { cn } from "@/lib/utils";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import {
  characterCatalogName,
  localizedName,
  localizedPropertyName,
} from "@/services/catalog/presentation";

const STATUS_LABELS: Record<CompletionStatus, MessageKey> = {
  missing: "evaluation.status.missing",
  "main-stat": "evaluation.status.mainStat",
  develop: "evaluation.status.develop",
  ready: "evaluation.status.ready",
};

export function BuildCompletionCard({
  completion,
  references,
  account,
}: {
  completion: BuildCompletion;
  references: BuildReferences;
  account: AccountSnapshot;
}) {
  const { locale, t } = useI18n();
  const { build } = completion;
  const character = references.characters.byId.get(build.characterDefinitionId);
  const characterName = character
    ? characterCatalogName(character, locale, t("terms.trailblazer"))
    : build.characterDefinitionId;
  const query = new URLSearchParams({
    character: build.characterDefinitionId,
    build: build.id,
  }).toString();
  const setIds =
    build.category === "planar"
      ? [build.planarSetId]
      : build.cavern.mode === "four-piece"
        ? [build.cavern.setId]
        : build.cavern.setIds;
  const setNames = setIds.map((id) =>
    localizedName(references.relicSets.byId.get(id)?.name, locale, id)
  );
  return (
    <article
      className="min-w-0 rounded-xl border border-border bg-gradient-card p-3 sm:p-4"
      data-build-completion={build.id}
    >
      <header className="mb-3 flex min-w-0 items-center gap-2.5">
        {character && (
          <AssetImage
            kind="character"
            variant="round"
            id={character.id}
            sourcePath={character.icon_path}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full bg-muted object-cover object-top"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">
            {characterName}
            {build.name && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {build.name}
              </span>
            )}
          </h2>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RelicKindIcon kind={build.category} decorative />
            {t(
              build.category === "planar"
                ? "evaluation.planar"
                : build.cavern.mode === "four-piece"
                  ? "evaluation.fourPiece"
                  : "evaluation.twoPlusTwo"
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "font-mono text-lg",
              completion.complete ? "text-primary" : "text-foreground"
            )}
          >
            {completion.acceptedCount}
            <span className="text-sm text-muted-foreground">
              /{completion.slots.length}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {t("evaluation.mainStats")}
          </p>
        </div>
      </header>
      <p className="mb-3 truncate text-sm" title={setNames.join(" + ")}>
        {setNames.join(" + ")}
      </p>
      <div
        className={cn(
          "grid grid-cols-2 gap-2",
          build.category === "cavern" && "lg:grid-cols-4"
        )}
      >
        {completion.slots.map((slot) => {
          const piece = slot.relic
            ? references.relicPieces.byId.get(slot.relic.definitionId)
            : undefined;
          const slotName = localizedName(
            references.properties.relicSlotById.get(
              CATALOG_RELIC_SLOT[slot.slot]
            )?.name,
            locale,
            slot.slot
          );
          const setName = localizedName(
            references.relicSets.byId.get(slot.setId)?.name,
            locale,
            slot.setId
          );
          const wearer = slot.relic?.equippedCharacterKey
            ? account.characters.find(
                (entry) => entry.key === slot.relic?.equippedCharacterKey
              )
            : undefined;
          const wearerDefinition = wearer
            ? references.characters.byId.get(wearer.definitionId)
            : undefined;
          const wearerName = wearerDefinition
            ? characterCatalogName(
                wearerDefinition,
                locale,
                t("terms.trailblazer")
              )
            : null;
          return (
            <div
              key={slot.slot}
              className="min-w-0 rounded-lg border border-border bg-background/40 p-2.5"
              data-completion-slot={slot.slot}
              data-status={slot.status}
            >
              <p className="mb-2 truncate text-xs font-semibold">{slotName}</p>
              <div className="flex items-center gap-2">
                {slot.relic && piece ? (
                  <CatalogHoverCard
                    kind="relic-piece"
                    id={piece.id}
                    relic={slot.relic}
                  >
                    <ItemIcon
                      kind="relic-piece"
                      id={piece.id}
                      sourcePath={piece.icon_path}
                      alt={localizedName(piece.name, locale, piece.id)}
                      rarity={slot.relic.rarity}
                      level={`+${slot.relic.level}`}
                      locked={slot.relic.locked}
                      size="sm"
                      tabIndex={0}
                    />
                  </CatalogHoverCard>
                ) : (
                  <CircleAlert
                    className="h-8 w-8 text-muted-foreground"
                    aria-hidden
                  />
                )}
                <div className="min-w-0">
                  <p
                    className={cn(
                      "flex items-center gap-1 text-xs",
                      slot.status === "ready"
                        ? "text-primary"
                        : "text-foreground"
                    )}
                  >
                    {slot.status === "ready" && (
                      <Check className="h-3 w-3" aria-hidden />
                    )}
                    {t(STATUS_LABELS[slot.status])}
                  </p>
                  <p
                    className="truncate text-xs text-muted-foreground"
                    title={setName}
                  >
                    {setName}
                  </p>
                </div>
              </div>
              <p className="mt-2 min-h-8 text-xs leading-4 text-muted-foreground">
                {t("evaluation.targetMainStats", {
                  stats: slot.mainStatIds
                    .map((id) =>
                      localizedPropertyName(id, references.properties, locale)
                    )
                    .join(" / "),
                })}
              </p>
              {slot.status === "main-stat" && slot.relic && (
                <p className="mt-1 truncate text-xs">
                  {localizedPropertyName(
                    slot.relic.mainStat.statId,
                    references.properties,
                    locale
                  )}
                </p>
              )}
              {slot.score?.mainStatAccepted ? (
                <p className="mt-1 font-mono text-sm">
                  <span>
                    {slot.score.grade} {slot.score.total.toFixed(1)}
                  </span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    → {slot.potentialScore?.toFixed(1)}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("evaluation.matchingPieces", {
                    count: slot.acceptedCount,
                  })}
                </p>
              )}
              {wearerName && (
                <p
                  className="mt-1 truncate text-xs text-muted-foreground"
                  title={t("evaluation.equippedBy", { character: wearerName })}
                >
                  {t("evaluation.equippedBy", { character: wearerName })}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {t("evaluation.readyPieces", {
            count: completion.readyCount,
            total: completion.slots.length,
          })}
          {completion.averageScore !== null && (
            <span className="ml-2">
              {t("evaluation.averageScore", {
                score: completion.averageScore.toFixed(1),
              })}
            </span>
          )}
        </p>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`${APP_PATHS.resources}?${query}`}>
              {t("evaluation.resources")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${APP_PATHS.recommendations}?${query}`}>
              {t("evaluation.recommendations")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </footer>
    </article>
  );
}
