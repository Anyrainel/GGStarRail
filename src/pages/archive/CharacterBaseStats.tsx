import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { formatCatalogValue } from "@/lib/game/text";
import type {
  CharacterDefinition,
  CharacterStatScaling,
  LinearStat,
} from "@/providers/reference/types";

/** The top ascension caps, like the in-game level breakpoints that matter. */
const LEVEL_ROWS = 4;

const GROWING_STATS = [
  { key: "hp", label: "stat.short.hp" },
  { key: "attack", label: "stat.short.atk" },
  { key: "defence", label: "stat.short.def" },
] as const satisfies readonly {
  key: keyof CharacterStatScaling["stats"];
  label: MessageKey;
}[];

function statAtCap(scaling: CharacterStatScaling, stat: LinearStat): number {
  return stat.base_value + stat.level_add * (scaling.max_level - 1);
}

/** Level-dependent stats as a table, then the fixed ones as a list. */
export function CharacterBaseStats({
  character,
}: {
  character: CharacterDefinition;
}) {
  const { t } = useI18n();
  const top = character.stat_scaling.at(-1);
  if (!top) return null;
  const levels = character.stat_scaling.slice(-LEVEL_ROWS);
  const levelLabel = (scaling: CharacterStatScaling) =>
    t("archive.levelShort", { value: scaling.max_level });
  const flat = (scaling: CharacterStatScaling, stat: LinearStat) =>
    formatCatalogValue(Math.floor(statAtCap(scaling, stat)), "flat");
  const fixed = [
    { label: t("stat.short.spd"), value: flat(top, top.stats.speed) },
    {
      label: t("beta.stat.critRate"),
      value: formatCatalogValue(
        statAtCap(top, top.stats.critical_chance),
        "ratio"
      ),
    },
    {
      label: t("beta.stat.critDamage"),
      value: formatCatalogValue(
        statAtCap(top, top.stats.critical_damage),
        "ratio"
      ),
    },
    { label: t("beta.stat.aggro"), value: flat(top, top.stats.base_aggro) },
    {
      label: t("archive.currencyWar.maxEnergy"),
      value: formatCatalogValue(character.max_energy, "flat"),
    },
  ];
  const title = t("archive.baseStats");
  return (
    <section
      aria-label={title}
      className="rounded-lg border border-border bg-card/50 p-3"
      data-testid="character-base-stats"
    >
      {/* Phones: stats as rows and levels as columns, so nothing scrolls. */}
      <table className="w-full text-sm md:hidden">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="py-1 text-left font-semibold">{title}</th>
            {levels.map((scaling) => (
              <th
                key={scaling.max_level}
                className="w-16 py-1 text-right font-medium"
              >
                {levelLabel(scaling)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROWING_STATS.map((stat) => (
            <tr key={stat.key}>
              <td className="py-0.5 text-muted-foreground">{t(stat.label)}</td>
              {levels.map((scaling) => (
                <td
                  key={scaling.max_level}
                  className="w-16 py-0.5 text-right font-medium tabular-nums"
                >
                  {flat(scaling, scaling.stats[stat.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Wider screens: levels as rows and stats as columns. */}
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="whitespace-nowrap py-1 text-left font-semibold">
              {title}
            </th>
            {GROWING_STATS.map((stat) => (
              <th
                key={stat.key}
                className="whitespace-nowrap px-2 py-1 text-right font-medium"
              >
                {t(stat.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {levels.map((scaling) => (
            <tr key={scaling.max_level}>
              <td className="whitespace-nowrap py-0.5 text-muted-foreground">
                {levelLabel(scaling)}
              </td>
              {GROWING_STATS.map((stat) => (
                <td
                  key={stat.key}
                  className="whitespace-nowrap px-2 py-0.5 text-right font-medium tabular-nums"
                >
                  {flat(scaling, scaling.stats[stat.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 border-t border-border pt-2 text-sm sm:grid-cols-3 xl:grid-cols-5">
        {fixed.map((stat) => (
          <div
            key={stat.label}
            className="flex min-w-0 items-center justify-between gap-2 py-0.5"
          >
            <dt className="truncate text-muted-foreground">{stat.label}</dt>
            <dd className="shrink-0 font-medium tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
