import { useI18n } from "@/i18n/I18nContext";
import type {
  CharacterDefinition,
  PropertyCatalog,
} from "@/providers/reference/types";
import { characterCatalogName } from "@/services/catalog/presentation";
import { CharacterBadgeGroup } from "./CharacterBadgeGroup";

export function CharacterInfo({
  character,
  properties,
}: {
  character: CharacterDefinition;
  properties: PropertyCatalog;
}) {
  const { locale, t } = useI18n();
  return (
    <div className="min-w-0 space-y-1.5">
      <h2 className="truncate text-lg font-bold leading-tight text-foreground md:text-xl">
        {characterCatalogName(character, locale, t("terms.trailblazer"))}
      </h2>
      <CharacterBadgeGroup character={character} properties={properties} />
    </div>
  );
}
