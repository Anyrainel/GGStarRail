import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import type { MemberPanelSummary } from "@/lib/combat/jobs";

const STATS: readonly {
  key: keyof MemberPanelSummary;
  label: MessageKey;
  percent: boolean;
}[] = [
  { key: "hp", label: "stat.short.hp", percent: false },
  { key: "atk", label: "stat.short.atk", percent: false },
  { key: "def", label: "stat.short.def", percent: false },
  { key: "spd", label: "stat.short.spd", percent: false },
  { key: "critRate", label: "stat.short.critRate", percent: true },
  { key: "critDmg", label: "stat.short.critDamage", percent: true },
  { key: "breakEffect", label: "stat.short.breakEffect", percent: true },
  { key: "energyRegen", label: "stat.short.energyRegen", percent: true },
  { key: "effectHitRate", label: "stat.short.effectHit", percent: true },
  { key: "elation", label: "stat.short.elation", percent: true },
];

/** Battle-start panel: base, Light Cone, Relics, Traces, and permanent effects. */
export function MemberStats({ panel }: { panel: MemberPanelSummary }) {
  const { locale, t } = useI18n();
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const speed = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  });
  return (
    <dl
      className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-x-4 gap-y-1 rounded-md border border-border bg-background/40 p-2 text-xs"
      aria-label={t("combat.member.stats")}
    >
      {STATS.filter((stat) => stat.key !== "elation" || panel.elation > 0).map(
        (stat) => (
          <div key={stat.key} className="flex min-w-0 justify-between gap-1">
            <dt className="text-muted-foreground">{t(stat.label)}</dt>
            <dd className="font-medium tabular-nums">
              {stat.percent
                ? percent.format(panel[stat.key])
                : stat.key === "spd"
                  ? speed.format(panel[stat.key])
                  : whole.format(panel[stat.key])}
            </dd>
          </div>
        )
      )}
    </dl>
  );
}
