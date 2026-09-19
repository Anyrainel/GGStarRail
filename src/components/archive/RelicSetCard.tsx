import { AssetImage } from "@/components/shared/AssetImage";
import { BetaBadge } from "@/components/shared/BetaBadge";
import { useI18n } from "@/i18n/I18nContext";
import { formatGameText } from "@/lib/gameText";
import { getLocalizedValue } from "@/providers/gilore/catalog";
import type {
  RelicPieceDefinition,
  RelicSetDefinition,
  RelicSlotId,
} from "@/providers/gilore/types";

const SLOT_ORDER: readonly RelicSlotId[] = [
  "HEAD",
  "HAND",
  "BODY",
  "FOOT",
  "NECK",
  "OBJECT",
];

export function RelicSetCard({
  relicSet,
  pieces,
}: {
  relicSet: RelicSetDefinition;
  pieces: readonly RelicPieceDefinition[];
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
      aria-label={name}
      className="overflow-hidden rounded-xl border border-border bg-card/60"
    >
      <div className="bg-gradient-to-b from-accent/40 to-transparent px-4 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <AssetImage
            kind="relic-set"
            id={relicSet.id}
            sourcePath={relicSet.icon_path}
            alt=""
            className="h-11 w-11 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight">{name}</h2>
            <BetaBadge member="relic_sets" id={relicSet.id} />
          </div>
        </div>
        <div className="mt-3 flex justify-center gap-2">
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
                className="h-12 w-12 shrink-0 object-contain drop-shadow-sm sm:h-14 sm:w-14"
              />
            );
          })}
        </div>
      </div>
      <div className="space-y-3 px-4 pb-4">
        {relicSet.bonuses.map((bonus) => (
          <p key={bonus.required_pieces} className="text-sm leading-6">
            <span className="mr-1.5 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold leading-4 text-primary">
              {t("archive.setPieces", { value: bonus.required_pieces })}
            </span>
            {formatGameText(
              getLocalizedValue(bonus.description, locale),
              bonus.parameters,
              t("terms.trailblazer")
            )}
          </p>
        ))}
      </div>
    </article>
  );
}
