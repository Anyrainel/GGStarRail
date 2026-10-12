import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import type { CurrencyWarStarLevel } from "@/providers/reference/types";
import { formatStarValues } from "@/services/catalog/currencyWarPresentation";
import {
  CurrencyWarPropertyList,
  CurrencyWarPropertyRow,
} from "./CurrencyWarDetails";

const chargeLabels: Readonly<Record<string, MessageKey>> = {
  EnergyBar: "archive.currencyWar.charge",
  MaxHP: "archive.currencyWar.maxHp",
  MaxSP: "archive.currencyWar.maxEnergy",
  Speed: "archive.currencyWar.speed",
};

export function CurrencyWarCharacterStats({
  starLevels,
  position,
  chargeTypes,
}: {
  starLevels: readonly CurrencyWarStarLevel[];
  position: "Front" | "Back";
  chargeTypes: readonly string[];
}) {
  const { t } = useI18n();
  const values: {
    key: MessageKey;
    field: keyof CurrencyWarStarLevel;
    ratio?: boolean;
  }[] = [
    {
      key:
        position === "Front"
          ? "archive.currencyWar.onFieldStrength"
          : "archive.currencyWar.offFieldStrength",
      field: position === "Front" ? "front_power" : "back_power",
    },
    ...(position === "Back"
      ? [
          {
            key: "archive.currencyWar.initialEnergy" as const,
            field: "initial_energy" as const,
          },
          {
            key: "archive.currencyWar.maxEnergy" as const,
            field: "max_energy" as const,
          },
          {
            key: "archive.currencyWar.initialCharge" as const,
            field: "initial_energy_bar" as const,
          },
          {
            key: "archive.currencyWar.maxCharge" as const,
            field: "energy_bar" as const,
          },
        ]
      : []),
    {
      key: "archive.currencyWar.luckyStrikeRate",
      field: "luck_chance",
      ratio: true,
    },
    {
      key: "archive.currencyWar.luckyStrikeDamage",
      field: "luck_damage",
      ratio: true,
    },
    { key: "archive.currencyWar.healingStrength", field: "heal_base" },
    { key: "archive.currencyWar.shieldStrength", field: "shield_base" },
  ];
  const visibleValues = values.filter((entry) =>
    starLevels.some((star) => typeof star[entry.field] === "number")
  );
  return (
    <section className="space-y-2">
      <h4 className="px-1 text-sm font-semibold text-muted-foreground">
        {t("archive.currencyWar.combatStats")}
      </h4>
      {position === "Back" &&
        chargeTypes.some((type) => chargeLabels[type]) && (
          <p className="px-1 text-xs">
            <span className="font-medium">
              {t("archive.currencyWar.scaling")}:{" "}
            </span>
            {chargeTypes
              .flatMap((type) =>
                chargeLabels[type] ? [t(chargeLabels[type])] : []
              )
              .join(" · ")}
          </p>
        )}
      <CurrencyWarPropertyList columns>
        {visibleValues.map((entry) => (
          <CurrencyWarPropertyRow
            key={entry.key}
            label={t(entry.key)}
            value={formatStarValues(
              starLevels.map((star) =>
                typeof star[entry.field] === "number"
                  ? (star[entry.field] as number)
                  : null
              ),
              entry.ratio ? "ratio" : "flat"
            )}
          />
        ))}
      </CurrencyWarPropertyList>
    </section>
  );
}
