import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { cn } from "@/lib/utils";
import { characterAffiliationIds } from "@/providers/reference/characterAffiliations";
import type {
  CharacterDefinition,
  PropertyCatalog,
} from "@/providers/reference/types";
import {
  characterCatalogPresentation,
  localizedName,
} from "@/services/catalog/presentation";
import { AssetImage } from "./AssetImage";
import { RarityStars } from "./RarityStars";

const AFFILIATION_KEYS: Readonly<Record<string, MessageKey>> = {
  "100": "affiliation.100",
  "101": "affiliation.101",
  "102": "affiliation.102",
  "103": "affiliation.103",
  "104": "affiliation.104",
  "105": "affiliation.105",
  "106": "affiliation.106",
  "107": "affiliation.107",
  "108": "affiliation.108",
  "109": "affiliation.109",
  "110": "affiliation.110",
  "111": "affiliation.111",
  "112": "affiliation.112",
  "113": "affiliation.113",
  "114": "affiliation.114",
  "115": "affiliation.115",
  "116": "affiliation.116",
  "117": "affiliation.117",
  "118": "affiliation.118",
  "119": "affiliation.119",
  "120": "affiliation.120",
};

export function CharacterBadgeGroup({
  character,
  properties,
}: {
  character: CharacterDefinition;
  properties: PropertyCatalog;
}) {
  const { locale, t } = useI18n();
  const presentation = characterCatalogPresentation(
    character,
    properties,
    locale,
    t("terms.trailblazer")
  );
  const path = properties.pathById.get(character.path_id);
  const combatType = properties.combatTypeById.get(character.combat_type_id);
  const affiliation =
    AFFILIATION_KEYS[characterAffiliationIds[character.id] ?? ""];
  const badgeClass =
    "min-h-6 max-w-full gap-1 rounded-full border-2 border-current px-1.5 py-0 text-xs font-medium shadow-none md:min-h-7 md:px-2.5 md:py-0.5 md:text-sm";
  const iconClass = "h-3.5 w-3.5 shrink-0 object-contain md:h-5 md:w-5";
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 md:gap-2">
      {combatType && (
        <Badge variant="outline" className={badgeClass}>
          <AssetImage
            kind="combat-type"
            id={combatType.id}
            sourcePath={combatType.icon_path}
            alt=""
            aria-hidden="true"
            className={iconClass}
          />
          {presentation.combatTypeName}
        </Badge>
      )}
      <Badge
        variant="outline"
        className={cn(badgeClass, "hidden md:inline-flex")}
      >
        <RarityStars rarity={character.rarity} />
      </Badge>
      {path && (
        <Badge variant="outline" className={badgeClass}>
          <AssetImage
            kind="path"
            id={path.id}
            sourcePath={path.icon_path}
            alt=""
            aria-hidden="true"
            className={iconClass}
          />
          {localizedName(path.name, locale, path.id)}
        </Badge>
      )}
      {affiliation && (
        <Badge
          variant="outline"
          className={cn(badgeClass, "hidden md:inline-flex")}
        >
          <span className="truncate">{t(affiliation)}</span>
        </Badge>
      )}
    </div>
  );
}
