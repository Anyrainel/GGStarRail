import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { formatCatalogValue, formatGameText } from "@/lib/game/text";
import { formatGameTextVariants } from "@/lib/game/textVariants";
import { cn } from "@/lib/utils";
import { getLocalizedValue } from "@/providers/reference/catalog";
import type {
  CurrencyWarBondTier,
  CurrencyWarPropertyValue,
  CurrencyWarStarLevel,
  LocalizedText,
  PropertyCatalog,
} from "@/providers/reference/types";
import { formatStarValues } from "@/services/catalog/currencyWarPresentation";

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

/** Source placeholders whose parameter is missing from the export. */
const UNRESOLVED_PARAMETER = /#\d+\[[^\]]+\]%?/g;

export function CurrencyWarText({
  text,
  parameters = [],
  className,
  parameterFormat,
  parameterVariants,
}: {
  text: LocalizedText | null | undefined;
  parameters?: readonly number[];
  className?: string;
  parameterFormat?: string | null;
  parameterVariants?: readonly { parameters: readonly number[] }[];
}) {
  const { locale, t } = useI18n();
  if (!text) return null;
  const template = parameterFormat
    ? getLocalizedValue(text, locale).replace(
        /#(\d+)(?![\da-zA-Z[])(%?)/g,
        (_token, index: string) => `#${index}${parameterFormat}`
      )
    : getLocalizedValue(text, locale);
  return (
    <p
      className={cn(
        "whitespace-pre-line break-words text-sm leading-6",
        className
      )}
    >
      {(parameterVariants
        ? formatGameTextVariants(
            template,
            parameterVariants,
            t("terms.trailblazer")
          )
        : formatGameText(template, parameters, t("terms.trailblazer"))
      ).replace(UNRESOLVED_PARAMETER, "—")}
    </p>
  );
}

export function CurrencyWarStarProperties({
  stars,
  properties,
}: {
  stars: readonly CurrencyWarStarLevel[];
  properties: PropertyCatalog;
}) {
  const { locale, t } = useI18n();
  const definitions = [
    ...new Map(
      stars.flatMap((star) =>
        star.properties.map((value) => [value.property_id, value] as const)
      )
    ).values(),
  ];
  if (!definitions.length) return null;
  return (
    <CurrencyWarPropertyList columns>
      {definitions.map((value) => {
        const property = properties.propertyById.get(value.property_id);
        return (
          <CurrencyWarPropertyRow
            key={value.property_id}
            label={formatGameText(
              getLocalizedValue(
                value.name ?? property?.relic_name ?? property?.name,
                locale
              ) ?? t("archive.sourceValueMissing")
            )}
            value={formatStarValues(
              stars.map(
                (star) =>
                  star.properties.find(
                    (entry) => entry.property_id === value.property_id
                  )?.value
              ),
              value.value_kind ?? property?.value_kind ?? "unknown"
            )}
          />
        );
      })}
    </CurrencyWarPropertyList>
  );
}

/** One bordered list of label and value rows. */
export function CurrencyWarPropertyList({
  columns = false,
  children,
}: {
  /** Two columns once the list itself is wide enough for both. */
  columns?: boolean;
  children: ReactNode;
}) {
  const list = (
    <dl
      className={cn(
        "grid grid-cols-1 gap-y-0.5 rounded-lg border border-border bg-card/30 p-3",
        columns &&
          "[@container(min-width:36rem)]:grid-cols-2 [@container(min-width:36rem)]:gap-x-6"
      )}
    >
      {children}
    </dl>
  );
  // A detail pane can be narrow on a wide viewport, so measure the pane.
  return columns ? (
    <div className="[container-type:inline-size]">{list}</div>
  ) : (
    list
  );
}

export function CurrencyWarPropertyRow({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 py-0.5">
      <dt className="min-w-0 break-words text-sm text-muted-foreground">
        {label}
      </dt>
      <dd className="shrink-0 font-mono text-sm font-medium">{value}</dd>
    </div>
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
    <CurrencyWarPropertyList>
      {values.map((value) => {
        const property = properties.propertyById.get(value.property_id);
        return (
          <CurrencyWarPropertyRow
            key={value.property_id}
            label={formatGameText(
              getLocalizedValue(
                value.name ?? property?.relic_name ?? property?.name,
                locale
              ) ?? t("archive.sourceValueMissing")
            )}
            value={formatCatalogValue(
              value.value,
              value.value_kind ?? property?.value_kind ?? "unknown"
            )}
          />
        );
      })}
    </CurrencyWarPropertyList>
  );
}

export function CurrencyWarSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 px-1 text-base font-semibold text-muted-foreground">
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {title}
      </h3>
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
    <div className="space-y-2">
      {tiers.map((tier) => (
        <section
          key={tier.required_count}
          className="space-y-2 rounded-lg border border-border bg-card/30 p-3"
        >
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary/15 px-1 text-primary">
              {tier.required_count}
            </span>
            {t("archive.currencyWar.requiredCharacters", {
              value: tier.required_count,
            })}
          </h4>
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
