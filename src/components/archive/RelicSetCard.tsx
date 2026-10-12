import { AssetImage } from "@/components/shared/AssetImage";
import { BetaBadge } from "@/components/shared/BetaBadge";
import { RelicKindIcon } from "@/components/shared/relic/RelicKindIcon";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/game/text";
import { getLocalizedValue } from "@/providers/reference/catalog";
import type {
  RelicPieceDefinition,
  RelicSetDefinition,
  RelicSlotId,
} from "@/providers/reference/types";
import { CollapsibleBody } from "./CollapsibleBody";

/** In-game order: Head, Hands, Body, Feet, then Planar Sphere and Link Rope. */
const SLOT_ORDER: readonly RelicSlotId[] = [
  "HEAD",
  "HAND",
  "BODY",
  "FOOT",
  "NECK",
  "OBJECT",
];

/** Bonus text taller than this collapses behind a fade. */
const COLLAPSED_HEIGHT = 180;

export function RelicSetCard({
  relicSet,
  pieces,
  expanded,
  onToggleExpanded,
}: {
  relicSet: RelicSetDefinition;
  pieces: readonly RelicPieceDefinition[];
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const { locale, t } = useI18n();
  const name = formatGameText(getLocalizedValue(relicSet.name, locale));
  const slots = new Map<RelicSlotId, RelicPieceDefinition>();
  for (const piece of pieces) {
    const current = slots.get(piece.slot);
    if (!current || current.rarity < piece.rarity) slots.set(piece.slot, piece);
  }
  return (
    <article
      data-relic-set-id={relicSet.id}
      data-relic-kind={relicSet.kind}
      aria-label={name}
      className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex items-center justify-center gap-1 bg-gradient-to-b from-accent/40 to-transparent px-4 pb-1 pt-3 sm:gap-2 sm:pt-4">
        {SLOT_ORDER.map((slot) => {
          const piece = slots.get(slot);
          if (!piece) return null;
          const pieceName = formatGameText(
            getLocalizedValue(piece.name, locale)
          );
          return (
            <AssetImage
              key={slot}
              kind="relic-piece"
              id={piece.id}
              sourcePath={piece.icon_path}
              alt={pieceName}
              title={pieceName}
              className="h-12 w-12 shrink-0 object-contain drop-shadow-md sm:h-14 sm:w-14"
            />
          );
        })}
      </div>
      <div className="flex flex-1 flex-col px-3 pb-3">
        <CollapsibleBody
          expanded={expanded}
          onToggle={onToggleExpanded}
          maxHeight={COLLAPSED_HEIGHT}
          className="rounded-lg bg-accent/20 text-sm"
          contentClassName="space-y-2 p-3"
          fadeClassName="from-accent/50 via-accent/30 to-transparent"
        >
          <div className="flex items-center justify-center gap-1.5">
            <RelicKindIcon
              kind={relicSet.kind === "planar_ornament" ? "planar" : "cavern"}
              className="text-muted-foreground"
            />
            <h2 className="text-center text-lg font-semibold leading-tight">
              {name}
            </h2>
            <BetaBadge member="relic_sets" id={relicSet.id} />
          </div>
          {relicSet.bonuses.map((bonus) => (
            <p
              key={bonus.required_pieces}
              className="leading-relaxed text-muted-foreground"
            >
              <span className="mr-1.5 rounded bg-primary/10 px-1.5 py-0.5 align-middle text-xs font-semibold leading-none text-primary">
                {t("archive.setPieces", { value: bonus.required_pieces })}
              </span>
              {formatGameText(
                getLocalizedValue(bonus.description, locale),
                bonus.parameters,
                t("terms.trailblazer")
              )}
            </p>
          ))}
        </CollapsibleBody>
      </div>
    </article>
  );
}
