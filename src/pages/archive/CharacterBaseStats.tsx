import { useI18n } from "@/i18n/I18nContext";
import { formatCatalogValue } from "@/lib/gameText";
import type {
  CharacterDefinition,
  LinearStat,
} from "@/providers/reference/types";

export function CharacterBaseStats({
  character,
}: {
  character: CharacterDefinition;
}) {
  const { t } = useI18n();
  const scaling = character.stat_scaling.at(-1);
  if (!scaling) return null;
  const value = (stat: LinearStat) =>
    stat.base_value + stat.level_add * (scaling.max_level - 1);
  const stats = [
    { label: t("stat.short.hp"), value: value(scaling.stats.hp) },
    { label: t("stat.short.atk"), value: value(scaling.stats.attack) },
    { label: t("stat.short.def"), value: value(scaling.stats.defence) },
    { label: t("stat.short.spd"), value: value(scaling.stats.speed) },
    {
      label: t("beta.stat.critRate"),
      value: value(scaling.stats.critical_chance),
      ratio: true,
    },
    {
      label: t("beta.stat.critDamage"),
      value: value(scaling.stats.critical_damage),
      ratio: true,
    },
    { label: t("beta.stat.aggro"), value: value(scaling.stats.base_aggro) },
    { label: t("archive.currencyWar.maxEnergy"), value: character.max_energy },
  ];
  return (
    <section
      className="space-y-2"
      aria-label={t("archive.level", { value: scaling.max_level })}
    >
      <p className="text-xs font-medium text-muted-foreground">
        {t("archive.level", { value: scaling.max_level })}
      </p>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between gap-2 rounded bg-secondary/40 px-2 py-1.5"
          >
            <dt>{stat.label}</dt>
            <dd className="font-semibold tabular-nums">
              {formatCatalogValue(
                stat.ratio ? stat.value : Math.floor(stat.value),
                stat.ratio ? "ratio" : "flat"
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
