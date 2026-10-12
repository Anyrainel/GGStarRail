import { DMG_BOOST_STAT_BY_COMBAT_TYPE } from "@/domain/stats";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { localizedPropertyName } from "@/services/catalog/presentation";
import { shortStatKey } from "@/services/catalog/relicPresentation";
import type { MemberPanelSummary } from "@/services/combat/jobs";
import { useTeamDmgData } from "../team/TeamDmgData";

type PanelStatKey = Exclude<keyof MemberPanelSummary, "combatType">;

const PANEL_STATS: readonly {
  key: PanelStatKey;
  /** Without a label, the stat is the member's Combat Type DMG Boost. */
  label?: MessageKey;
  format: "whole" | "speed" | "percent";
  /** Added for display: the in-game panel shows ERR from a 100% base. */
  base?: number;
  /** Listed only when the member has some (not every Character does). */
  optional?: boolean;
}[] = [
  { key: "hp", label: "stat.short.hp", format: "whole" },
  { key: "atk", label: "stat.short.atk", format: "whole" },
  { key: "def", label: "stat.short.def", format: "whole" },
  { key: "spd", label: "stat.short.spd", format: "speed" },
  { key: "critRate", label: "stat.short.critRate", format: "percent" },
  { key: "critDmg", label: "stat.short.critDamage", format: "percent" },
  { key: "breakEffect", label: "stat.short.breakEffect", format: "percent" },
  {
    key: "outgoingHealing",
    label: "stat.short.healing",
    format: "percent",
    optional: true,
  },
  {
    key: "energyRegen",
    label: "stat.short.energyRegen",
    format: "percent",
    base: 1,
  },
  { key: "effectHitRate", label: "stat.short.effectHit", format: "percent" },
  {
    key: "effectRes",
    label: "stat.short.effectRes",
    format: "percent",
    optional: true,
  },
  { key: "combatTypeDmg", format: "percent", optional: true },
  {
    key: "elation",
    label: "stat.short.elation",
    format: "percent",
    optional: true,
  },
];

function StatTable({
  label,
  rows,
}: {
  label: string;
  rows: readonly { key: string; label: string; value: string }[];
}) {
  return (
    <table
      aria-label={label}
      className="w-full border-collapse text-[10px] md:text-xs xl:text-sm"
    >
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="hover:bg-muted/40">
            <th
              scope="row"
              className="py-0.5 pr-2 text-left font-normal text-muted-foreground"
            >
              {row.label}
            </th>
            <td className="py-0.5 text-right font-medium tabular-nums">
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The battle-start panel: base, Light Cone, Relics, Traces and passives. */
export function PanelView({ panel }: { panel: MemberPanelSummary }) {
  const { locale, t } = useI18n();
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const speed = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const combatTypeKey = shortStatKey(
    DMG_BOOST_STAT_BY_COMBAT_TYPE[panel.combatType]
  );
  const rows = PANEL_STATS.filter(
    (stat) => !stat.optional || panel[stat.key] > 1e-9
  ).map((stat) => {
    const value = panel[stat.key] + (stat.base ?? 0);
    return {
      key: stat.key,
      label: stat.label
        ? t(stat.label)
        : combatTypeKey
          ? t(combatTypeKey)
          : panel.combatType,
      value:
        stat.format === "percent"
          ? percent.format(value)
          : stat.format === "speed"
            ? speed.format(value)
            : whole.format(value),
    };
  });
  return <StatTable label={t("combat.member.stats")} rows={rows} />;
}

function useStatLabel() {
  const { locale, t } = useI18n();
  const { references } = useTeamDmgData();
  return (propertyId: string) => {
    const short = shortStatKey(propertyId);
    return short
      ? t(short)
      : localizedPropertyName(propertyId, references.properties, locale);
  };
}

/** Substat rolls per stat across the six ideal Relics. */
export function RollsView({
  rolls,
}: {
  rolls: Readonly<Record<string, number>>;
}) {
  const { t } = useI18n();
  const statLabel = useStatLabel();
  const rows = Object.entries(rolls)
    .filter(([, count]) => count > 0)
    .sort(([, left], [, right]) => right - left)
    .map(([propertyId, count]) => ({
      key: propertyId,
      label: statLabel(propertyId),
      value: String(count),
    }));
  return <StatTable label={t("combat.tools.rolls")} rows={rows} />;
}

/** Relative value of one more roll of each stat (the best stat is 1). */
export function ValueView({
  weights,
}: {
  weights: Readonly<Record<string, number>>;
}) {
  const { locale, t } = useI18n();
  const statLabel = useStatLabel();
  const entries = Object.entries(weights)
    .filter(([, weight]) => weight > 0)
    .sort(([, left], [, right]) => right - left);
  const peak = Math.max(1e-9, entries[0]?.[1] ?? 0);
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const rows = entries.map(([propertyId, weight]) => ({
    key: propertyId,
    label: statLabel(propertyId),
    value: format.format(weight / peak),
  }));
  return <StatTable label={t("combat.tools.weights")} rows={rows} />;
}
