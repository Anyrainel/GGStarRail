import { RelicStatDisplay } from "@/components/game-account/RelicStatDisplay";
import { AssetImage } from "@/components/shared/AssetImage";
import { CatalogHoverCard } from "@/components/shared/CatalogHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import type { Relic } from "@/domain/game-account/schemas";
import type { ResourceSuggestion } from "@/domain/resources/types";
import { CATALOG_RELIC_SLOT } from "@/domain/stats";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import {
  characterCatalogName,
  localizedName,
  localizedPropertyName,
} from "@/services/catalog/presentation";
import { shortStatKey } from "@/services/catalog/relicPresentation";
import { RESOURCE_ACTION } from "./resourcePresentation";

const ROW_CLASS =
  "flex w-full min-w-0 items-start gap-2.5 rounded-lg border border-border bg-muted/15 px-3 py-2 text-left";

/**
 * One compact resource suggestion row: piece, action, set, main stat, numbers.
 * A row with an owned source Relic opens that Relic's stats.
 */
export function ResourceSuggestionCard({
  suggestion,
  references,
  sourceRelic,
}: {
  suggestion: ResourceSuggestion;
  references: BuildReferences;
  sourceRelic?: Relic;
}) {
  const { locale, t } = useI18n();
  const piece = references.relicPieces.byId.get(suggestion.targetDefinitionId);
  const set = references.relicSets.byId.get(suggestion.setId);
  const character = references.characters.byId.get(
    suggestion.characterDefinitionId
  );
  const action = RESOURCE_ACTION[suggestion.kind];
  const ActionIcon = action.icon;
  const actionWord = t(action.shortLabelKey);
  const setName = localizedName(set?.name, locale, suggestion.setId);
  const pieceName = localizedName(
    piece?.name,
    locale,
    suggestion.targetDefinitionId
  );
  const slotName = localizedName(
    references.properties.relicSlotById.get(CATALOG_RELIC_SLOT[suggestion.slot])
      ?.name,
    locale,
    suggestion.slot
  );
  const mainStatName = localizedPropertyName(
    suggestion.mainStatId,
    references.properties,
    locale
  );
  const mainStatKey = shortStatKey(suggestion.mainStatId);
  const mainStatShort = mainStatKey ? t(mainStatKey) : mainStatName;
  const characterName = character
    ? characterCatalogName(character, locale, t("terms.trailblazer"))
    : suggestion.characterDefinitionId;
  // Synthesis and Variable Dice costs are fixed (see the help dialog); only
  // a level-up row has a per-Relic range to show.
  const detail =
    suggestion.kind === "level-up"
      ? `+${suggestion.currentLevel} → +${suggestion.targetLevel}`
      : null;
  const relic = suggestion.kind === "synthesize" ? undefined : sourceRelic;
  const pieceId = piece?.id ?? suggestion.targetDefinitionId;

  const icon = (
    <CatalogHoverCard kind="relic-piece" id={pieceId} relic={relic}>
      <ItemIcon
        kind="relic-piece"
        id={pieceId}
        sourcePath={piece?.icon_path ?? ""}
        alt={relic ? `${pieceName}, +${relic.level}` : pieceName}
        rarity={relic?.rarity ?? piece?.rarity ?? null}
        level={relic ? `+${relic.level}` : undefined}
        locked={relic?.locked}
        size="md"
        // Inside the row button the icon only shows its card on hover.
        tabIndex={relic ? undefined : 0}
        className="shrink-0"
      />
    </CatalogHoverCard>
  );
  const content = (
    <>
      {icon}
      <span className="block min-w-0 flex-1 space-y-0.5 leading-tight">
        <span className="flex min-w-0 items-center gap-1 text-sm">
          <ActionIcon
            className="h-5 w-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span className="shrink-0 font-semibold text-primary">
            {actionWord}
          </span>
          <span className="min-w-0 flex-1 truncate text-foreground">
            {slotName}
          </span>
          {character && (
            <AssetImage
              kind="character"
              variant="round"
              id={character.id}
              sourcePath={character.icon_path}
              alt={t("resource.targetFor", { character: characterName })}
              title={t("resource.targetFor", { character: characterName })}
              className="h-6 w-6 shrink-0 rounded-full bg-muted object-cover object-top"
            />
          )}
        </span>
        <span className="flex min-w-0 items-end gap-2.5">
          <span className="block min-w-0 flex-1 space-y-0.5">
            <span
              className="block truncate text-xs text-foreground"
              title={setName}
            >
              {setName}
            </span>
            <span
              className="block truncate text-xs text-muted-foreground"
              title={detail ? `${mainStatName} · ${detail}` : mainStatName}
            >
              <span className="text-foreground">{mainStatShort}</span>
              {detail && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono">{detail}</span>
                </>
              )}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="whitespace-nowrap font-mono text-sm leading-none text-primary">
              +{suggestion.opportunityScore.toFixed(1)}
              <span className="ml-0.5 font-sans text-xs text-muted-foreground">
                {t("resource.gainLabel")}
              </span>
            </span>
            {suggestion.currentScore !== null && (
              <span className="whitespace-nowrap font-mono text-sm leading-none text-[hsl(var(--quality-gold))]">
                {suggestion.currentScore.toFixed(1)}
                <span className="ml-0.5 font-sans text-xs text-muted-foreground">
                  {t("resource.scoreLabel")}
                </span>
              </span>
            )}
          </span>
        </span>
      </span>
    </>
  );

  if (!relic) {
    return (
      <article data-resource-action={suggestion.kind} className={ROW_CLASS}>
        {content}
      </article>
    );
  }

  return (
    <article data-resource-action={suggestion.kind} className="min-w-0">
      <ResponsiveDialog>
        <ResponsiveDialogTrigger
          className={cn(
            ROW_CLASS,
            "outline-hidden transition-colors hover:border-primary/70 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          {content}
        </ResponsiveDialogTrigger>
        <ResponsiveDialogContent
          className="md:max-w-sm"
          closeLabel={t("common.close")}
        >
          <ResponsiveDialogHeader className="flex items-center gap-3 space-y-0">
            <ItemIcon
              kind="relic-piece"
              id={pieceId}
              sourcePath={piece?.icon_path ?? ""}
              alt=""
              rarity={relic.rarity}
              level={`+${relic.level}`}
              locked={relic.locked}
              size="md"
              className="shrink-0"
            />
            <span className="block min-w-0 space-y-1">
              <ResponsiveDialogTitle className="truncate text-base">
                {setName}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {slotName} · {pieceName}
              </ResponsiveDialogDescription>
            </span>
          </ResponsiveDialogHeader>
          <div className="mx-auto mt-4 w-full max-w-xs overflow-hidden rounded-lg border border-border bg-card/60">
            <RelicStatDisplay
              relic={relic}
              references={references}
              locale={locale}
              slotName={slotName}
            />
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </article>
  );
}
