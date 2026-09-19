import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { formatCatalogValue } from "@/lib/gameText";
import type { CurrencyWarStarLevel } from "@/providers/gilore/types";

const chargeLabels: Readonly<Record<string, MessageKey>> = {
  EnergyBar: "archive.currencyWar.charge",
  MaxHP: "archive.currencyWar.maxHp",
  MaxSP: "archive.currencyWar.maxEnergy",
  Speed: "archive.currencyWar.speed",
};

export function CurrencyWarCharacterStats({
  starLevel,
  position,
  chargeTypes,
}: {
  starLevel: CurrencyWarStarLevel;
  position: "Front" | "Back";
  chargeTypes: readonly string[];
}) {
  const { t } = useI18n();
  const values: { key: MessageKey; value: number | null; ratio?: boolean }[] = [
    {
      key:
        position === "Front"
          ? "archive.currencyWar.onFieldStrength"
          : "archive.currencyWar.offFieldStrength",
      value:
        position === "Front" ? starLevel.front_power : starLevel.back_power,
    },
    ...(position === "Back"
      ? [
          {
            key: "archive.currencyWar.initialEnergy" as const,
            value: starLevel.initial_energy,
          },
          {
            key: "archive.currencyWar.maxEnergy" as const,
            value: starLevel.max_energy,
          },
          {
            key: "archive.currencyWar.initialCharge" as const,
            value: starLevel.initial_energy_bar,
          },
          {
            key: "archive.currencyWar.maxCharge" as const,
            value: starLevel.energy_bar,
          },
        ]
      : []),
    {
      key: "archive.currencyWar.luckyStrikeRate",
      value: starLevel.luck_chance,
      ratio: true,
    },
    {
      key: "archive.currencyWar.luckyStrikeDamage",
      value: starLevel.luck_damage,
      ratio: true,
    },
    { key: "archive.currencyWar.healingStrength", value: starLevel.heal_base },
    { key: "archive.currencyWar.shieldStrength", value: starLevel.shield_base },
  ];
  const visibleValues = values.filter(
    (entry) => entry.value !== null && entry.value !== undefined
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
                {formatCatalogValue(
                  entry.value!,
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
