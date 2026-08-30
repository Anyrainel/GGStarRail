import type { Locale } from "@/i18n/locales";
import { getLocalizedValue } from "@/providers/gilore/catalog";
import type {
  LocalizedText,
  PropertyDefinition,
} from "@/providers/gilore/types";

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
