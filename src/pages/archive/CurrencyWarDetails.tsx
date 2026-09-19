import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { formatCatalogValue, formatGameText } from "@/lib/gameText";
import { cn } from "@/lib/utils";
import { getLocalizedValue } from "@/providers/gilore/catalog";
import type {
  CurrencyWarBondTier,
  CurrencyWarPropertyValue,
  LocalizedText,
  PropertyCatalog,
} from "@/providers/gilore/types";

export function currencyWarSearchText(value: unknown): string {
  if (value === null || typeof value !== "object") return "";
  if (Array.isArray(value)) return value.map(currencyWarSearchText).join(" ");
  const record = value as Record<string, unknown>;
  if ("en" in record && "zh-CN" in record) {
    const text = value as LocalizedText;
    return formatGameText(
      `${text.en.value} ${text["zh-CN"].value}`
    ).toLocaleLowerCase();
  }
  return Object.values(record).map(currencyWarSearchText).join(" ");
}

export function CurrencyWarText({
  text,
  parameters = [],
  className,
  parameterFormat,
}: {
  text: LocalizedText | null | undefined;
  parameters?: readonly number[];
  className?: string;
  parameterFormat?: string | null;
}) {
  const { locale, t } = useI18n();
  if (!text) return null;
  return (
    <p
      className={cn(
        "whitespace-pre-line break-words text-sm leading-6",
        className
      )}
    >
      {formatGameText(
        parameterFormat
          ? getLocalizedValue(text, locale).replace(
              /#(\d+)(?![\da-zA-Z[])(%?)/g,
              (_token, index: string) => `#${index}${parameterFormat}`
            )
          : getLocalizedValue(text, locale),
        parameters,
        t("terms.trailblazer")
      )}
    </p>
  );
}

export function CurrencyWarProperties({
  values,
  properties,
}: {
  values: readonly CurrencyWarPropertyValue[];
  properties: PropertyCatalog;
}) {
  const { locale, t } = useI18n();
  if (!values.length) return null;
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {values.map((value) => {
        const property = properties.propertyById.get(value.property_id);
        return (
          <div
            key={value.property_id}
            className="flex items-center justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2 text-sm"
          >
            <dt>
              {formatGameText(
                getLocalizedValue(
                  value.name ?? property?.relic_name ?? property?.name,
                  locale
                ) ?? t("archive.sourceValueMissing")
              )}
            </dt>
            <dd className="font-semibold tabular-nums">
              {formatCatalogValue(
                value.value,
                value.value_kind ?? property?.value_kind ?? "unknown"
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function CurrencyWarSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function CurrencyWarBondTiers({
  tiers,
  properties,
}: {
  tiers: readonly CurrencyWarBondTier[];
  properties: PropertyCatalog;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {tiers.map((tier) => (
        <section
          key={tier.required_count}
          className="space-y-3 rounded-xl border border-border bg-background/40 p-3"
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-primary/15 px-1 text-primary">
              {tier.required_count}
            </span>
            {t("archive.currencyWar.requiredCharacters", {
              value: tier.required_count,
            })}
          </h3>
          <CurrencyWarText
            text={tier.description}
            parameters={tier.parameters}
          />
          <CurrencyWarText
            text={tier.property_description}
            parameters={tier.property_parameters}
          />
          {!tier.property_description && (
            <>
              <CurrencyWarProperties
                values={tier.member_properties}
                properties={properties}
              />
              <CurrencyWarProperties
                values={tier.team_properties}
                properties={properties}
              />
            </>
          )}
        </section>
      ))}
    </div>
  );
}
