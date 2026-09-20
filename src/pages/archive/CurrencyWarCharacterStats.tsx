import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { formatStarValues } from "@/lib/currencyWarPresentation";
import type { CurrencyWarStarLevel } from "@/providers/reference/types";

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
    <section className="rounded-lg border border-border bg-card/50 p-3">
      <h4 className="text-sm font-medium">
        {t("archive.currencyWar.combatStats")}
      </h4>
      <div className="mt-3 space-y-3">
        {position === "Back" &&
          chargeTypes.some((type) => chargeLabels[type]) && (
            <p className="text-xs">
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
        <dl className="grid gap-2 sm:grid-cols-2">
          {visibleValues.map((entry) => (
            <div
              key={entry.key}
              className="flex items-center justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2 text-xs"
            >
              <dt>{t(entry.key)}</dt>
              <dd className="font-semibold tabular-nums">
                {formatStarValues(
                  starLevels.map((star) =>
                    typeof star[entry.field] === "number"
                      ? (star[entry.field] as number)
                      : null
                  ),
                  entry.ratio ? "ratio" : "flat"
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
