import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import {
  characterCatalogPresentation,
  localizedName,
} from "@/lib/catalogPresentation";
import { characterAffiliationIds } from "@/providers/gilore/characterAffiliations";
import type {
  CharacterDefinition,
  PropertyCatalog,
} from "@/providers/gilore/types";
import { AssetImage } from "./AssetImage";

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

export function CharacterInfo({
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
    "max-w-full gap-1 rounded-full border-2 border-current px-1.5 py-0 text-xs font-medium shadow-none md:px-2 md:py-0.5 md:text-sm";
  return (
    <div className="min-w-0 space-y-1.5">
      <h2 className="text-lg font-bold leading-tight text-foreground md:text-xl">
        {presentation.name}
      </h2>
      <div className="flex flex-wrap items-center gap-1 md:gap-2">
        {combatType && (
          <Badge variant="outline" className={badgeClass}>
            <AssetImage
              kind="combat-type"
              id={combatType.id}
              sourcePath={combatType.icon_path}
              alt=""
              aria-hidden="true"
              className="h-3.5 w-3.5 object-contain md:h-4 md:w-4"
            />
            {presentation.combatTypeName}
          </Badge>
        )}
        <Badge
          variant="outline"
          className={badgeClass}
          aria-label={t("field.rarity", { value: character.rarity })}
        >
          <Star className="h-3 w-3 fill-current" aria-hidden="true" />
          {character.rarity}
        </Badge>
        {path && (
          <Badge variant="outline" className={badgeClass}>
            <AssetImage
              kind="path"
              id={path.id}
              sourcePath={path.icon_path}
              alt=""
              aria-hidden="true"
              className="h-3.5 w-3.5 object-contain md:h-4 md:w-4"
            />
            {localizedName(path.name, locale, path.id)}
          </Badge>
        )}
        {affiliation && (
          <Badge variant="outline" className={badgeClass}>
            {t(affiliation)}
          </Badge>
        )}
      </div>
    </div>
  );
}
