import type { Locale } from "@/i18n/locales";
import type { MessageKey } from "@/i18n/messages.en";
import type { BuildReferences } from "@/lib/buildReferences";
import { localizedName } from "@/lib/catalogPresentation";
import { formatGameText } from "@/lib/gameText";
import { shortStatKey } from "@/lib/relicPresentation";

export interface SetBonusLine {
  key: string;
  pieces: number;
  text: string;
}

/**
 * The bonuses a set plan activates: both bonuses of a 4-piece set, the
 * 2-piece bonus of each half of a 2+2 plan, or a Planar set's 2-piece bonus.
 */
export function setPlanBonuses(
  setIds: readonly string[],
  references: BuildReferences,
  locale: Locale,
  trailblazer: string
): SetBonusLine[] {
  const split = setIds.length > 1;
  return setIds.flatMap((setId) => {
    const set = references.relicSets.byId.get(setId);
    if (!set) return [];
    return set.bonuses
      .filter((bonus) => !split || bonus.required_pieces <= 2)
      .map((bonus) => ({
        key: `${setId}:${bonus.required_pieces}`,
        pieces: bonus.required_pieces,
        text: formatGameText(
          localizedName(bonus.description, locale, ""),
          bonus.parameters,
          trailblazer
        ).replace(/\s+/g, " "),
      }));
  });
}

/** A chip label: the short stat name when one exists, else the full name. */
export function shortStatLabel(
  propertyId: string,
  fullName: string,
  translate: (key: MessageKey) => string
): string {
  const key = shortStatKey(propertyId);
  return key ? translate(key) : fullName;
}
