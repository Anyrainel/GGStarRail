import { TRAILBLAZER_VARIANT_TERMS } from "@/i18n/gameTerms";
import type { Locale } from "@/i18n/locales";
import { formatGameText } from "@/lib/gameText";
import { getLocalizedValue } from "@/providers/gilore/catalog";
import type {
  CharacterDefinition,
  LocalizedText,
  PropertyCatalog,
  PropertyDefinition,
} from "@/providers/gilore/types";

const TRAILBLAZER_CHARACTER_ID = /^80(?:0[1-9]|10)$/;

export interface CharacterCatalogPresentation {
  name: string;
  pathName: string;
  combatTypeName: string;
  label: string;
}

export function localizedName(
  localized: LocalizedText | null | undefined,
  locale: Locale,
  fallback: string
): string {
  return getLocalizedValue(localized ?? null, locale) ?? fallback;
}

export function localizedSearchText(
  localized: LocalizedText | null | undefined,
  fallback: string
): string {
  return [
    getLocalizedValue(localized ?? null, "en"),
    getLocalizedValue(localized ?? null, "zh-CN"),
    fallback,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase();
}

export function characterCatalogPresentation(
  character: CharacterDefinition,
  properties: PropertyCatalog,
  locale: Locale,
  trailblazerFallback: string
): CharacterCatalogPresentation {
  const name = characterCatalogName(character, locale, trailblazerFallback);
  const pathName = formatGameText(
    localizedName(
      properties.pathById.get(character.path_id)?.name,
      locale,
      character.path_id
    )
  );
  const combatTypeName = formatGameText(
    localizedName(
      properties.combatTypeById.get(character.combat_type_id)?.name,
      locale,
      character.combat_type_id
    )
  );
  return {
    name,
    pathName,
    combatTypeName,
    label: `${name} · ${pathName} · ${combatTypeName}`,
  };
}

export function characterCatalogName(
  character: CharacterDefinition,
  locale: Locale,
  trailblazerFallback: string
): string {
  const sourceName = localizedName(character.name, locale, character.id);
  return sourceName === "{NICKNAME}" &&
    TRAILBLAZER_CHARACTER_ID.test(character.id)
    ? `${trailblazerFallback} · ${
        Number(character.id) % 2 === 1
          ? TRAILBLAZER_VARIANT_TERMS[locale].caelus
          : TRAILBLAZER_VARIANT_TERMS[locale].stelle
      }`
    : formatGameText(sourceName);
}

export function localizedPropertyName(
  propertyId: string,
  properties: PropertyCatalog,
  locale: Locale
): string {
  const property = properties.propertyById.get(propertyId);
  const name = formatGameText(
    localizedName(property?.relic_name ?? property?.name, locale, propertyId)
  );
  if (property?.value_kind !== "ratio") return name;

  const duplicatesFlatName = properties.properties.some((candidate) => {
    if (candidate.value_kind !== "flat") return false;
    return (
      formatGameText(
        localizedName(
          candidate.relic_name ?? candidate.name,
          locale,
          candidate.id
        )
      ) === name
    );
  });
  return duplicatesFlatName ? `${name}%` : name;
}

function isRatioProperty(property: PropertyDefinition | undefined): boolean {
  return (
    property?.value_kind === "ratio" ||
    (property !== undefined &&
      /(Ratio|Chance|DamageBase|Resistance|Probability)/.test(property.id))
  );
}

export function formatAccountStatValue(
  value: number,
  property: PropertyDefinition | undefined,
  locale: Locale
): string {
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
  });
  return `${formatter.format(value)}${isRatioProperty(property) ? "%" : ""}`;
}
