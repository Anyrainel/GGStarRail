import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import type { CritMode } from "@/domain/combat/model/formulas";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { cn } from "@/lib/utils";
import type { SimulateResponse } from "@/services/combat/jobs";
import {
  abilityDamageLabel,
  formatChange,
  formatCompactDamage,
  formatDamage,
  formatPercent,
} from "@/services/combat/presentation";
import { CompactSelect } from "../team/Controls";
import { MemberAvatar } from "../team/MemberAvatar";
import { TeamCharacterGrid } from "../team/TeamCharacterGrid";
import { useTeamDmgData } from "../team/TeamDmgData";

const CRIT_MODE_KEYS = {
  expected: "teamOptimizer.crit.expected",
  crit: "teamOptimizer.crit.crit",
  nonCrit: "teamOptimizer.crit.nonCrit",
} as const satisfies Record<CritMode, MessageKey>;

function initiallyExpanded(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(min-width: 768px)").matches
  );
}

function ShareBar({ share }: { share: number }) {
  return (
    <div className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }}
      />
    </div>
  );
}

interface AbilityRow {
  label: string;
  damage: number;
  hits: number;
}

/** Ability rows per team slot; rows with the same visible label merge. */
function abilityRowsBySlot(
  result: SimulateResponse,
  label: (entry: SimulateResponse["report"]["abilities"][number]) => string
): Map<number, AbilityRow[]> {
  const bySlot = new Map<number, Map<string, AbilityRow>>();
  for (const entry of result.report.abilities) {
    const rows = bySlot.get(entry.slot) ?? new Map<string, AbilityRow>();
    const text = label(entry);
    const row = rows.get(text);
    rows.set(text, {
      label: text,
      damage: (row?.damage ?? 0) + entry.damage,
      hits: (row?.hits ?? 0) + entry.hits,
    });
    bySlot.set(entry.slot, rows);
  }
  return new Map(
    [...bySlot].map(([slot, rows]) => [
      slot,
      [...rows.values()].sort((left, right) => right.damage - left.damage),
    ])
  );
}

function Breakdown({ result }: { result: SimulateResponse }) {
  const { locale, t } = useI18n();
  const { lookup } = useTeamDmgData();
  const rowsBySlot = abilityRowsBySlot(result, (entry) =>
    abilityDamageLabel(entry, t)
  );
  const shareBySlot = new Map(
    result.report.members.map((entry) => [entry.slot, entry.share])
  );
  const byCycle = result.report.byCycle;
  const peak = Math.max(1, ...byCycle);
  const hits = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const panels = [
    ...result.members.map((member) => ({
      slot: member.slot,
      characterId: member.characterId as string | null,
      name:
        lookup.characters.get(member.characterId)?.name ?? member.characterId,
    })),
    ...(rowsBySlot.has(-1)
      ? [{ slot: -1, characterId: null, name: t("teamOptimizer.other") }]
      : []),
  ];

  return (
    <div className="space-y-3 px-1 pb-1 pt-2">
      {byCycle.length > 0 && (
        <section
          aria-label={t("combat.damage.byCycle")}
          className="mx-auto flex max-w-3xl items-end gap-1 px-1 md:gap-2"
        >
          {byCycle.map((damage, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: cycles are positional
              key={index}
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
              title={`${t("combat.damage.cycleLabel", { index: index + 1 })} · ${formatDamage(damage, locale)}`}
            >
              <div className="flex h-10 w-full items-end">
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${Math.max(2, (damage / peak) * 100)}%` }}
                />
              </div>
              <span className="max-w-full truncate text-[10px] text-muted-foreground">
                {t("combat.damage.cycleLabel", { index: index + 1 })}
              </span>
            </div>
          ))}
        </section>
      )}
      <section aria-label={t("combat.damage.byAbility")}>
        <TeamCharacterGrid>
          {panels.map((panel) => {
            const share = shareBySlot.get(panel.slot) ?? 0;
            const rows = rowsBySlot.get(panel.slot) ?? [];
            return (
              <div
                key={panel.slot}
                className={cn(
                  "flex min-w-0 flex-col overflow-hidden rounded-lg border border-border",
                  rows.length === 0 && "self-start"
                )}
                data-damage-member={panel.slot}
              >
                <div
                  className={cn(
                    "flex min-w-0 items-center gap-2 px-3 py-1 md:py-2",
                    rows.length > 0 && "border-b border-border"
                  )}
                >
                  {panel.characterId ? (
                    <MemberAvatar characterId={panel.characterId} decorative />
                  ) : (
                    <Sparkles
                      className="h-5 w-5 shrink-0 text-muted-foreground md:h-7 md:w-7"
                      aria-hidden
                    />
                  )}
                  <span className="min-w-0 truncate text-xs font-bold md:text-sm">
                    {panel.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    ({formatPercent(share, locale, 0)})
                  </span>
                  <ShareBar share={share} />
                </div>
                {rows.length > 0 && (
                  // Columns follow the card's own width, not the viewport.
                  <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(10rem,100%),1fr))] gap-x-3 p-1">
                    {rows.map((row) => (
                      <li
                        key={row.label}
                        className="flex min-w-0 flex-col px-1 py-0.5"
                      >
                        <span className="truncate text-xs text-muted-foreground">
                          {row.label}
                        </span>
                        {/* The total wraps below the formula; it is never cut. */}
                        <span className="flex flex-wrap items-baseline gap-x-1 font-mono text-sm tabular-nums xl:text-base">
                          <span className="whitespace-nowrap">
                            {formatCompactDamage(
                              row.hits > 0 ? row.damage / row.hits : row.damage,
                              locale
                            )}
                            <span className="text-muted-foreground"> × </span>
                            {hits.format(row.hits)}
                          </span>
                          <span className="whitespace-nowrap">
                            <span className="text-muted-foreground">= </span>
                            <span className="font-semibold">
                              {formatCompactDamage(row.damage, locale)}
                            </span>
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </TeamCharacterGrid>
      </section>
    </div>
  );
}

/**
 * The team's damage per cycle in a centred pill, with the change against the
 * current team on the left and the battle total on the right. Expanding it
 * shows damage by cycle, by Character and by ability.
 */
export function DamagePill({
  result,
  reference,
  running,
  cycles,
  critMode,
  onCritModeChange,
}: {
  result: SimulateResponse | null;
  /** The current team, when the pill shows a different result. */
  reference: SimulateResponse | null;
  running: boolean;
  cycles: number;
  critMode: CritMode;
  onCritModeChange: (mode: CritMode) => void;
}) {
  const { locale, t } = useI18n();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const bodyId = useId();
  const total = result?.report.total ?? 0;
  const change =
    result && reference && reference.report.perCycle > 0
      ? result.report.perCycle / reference.report.perCycle - 1
      : null;

  return (
    <div
      className="rounded-lg border border-dashed border-border p-1 text-xs md:text-sm"
      data-damage-summary
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 md:flex-nowrap md:gap-x-0">
        <div className="order-2 flex min-w-0 justify-end empty:hidden md:order-1 md:flex-1 md:empty:flex">
          {change !== null && reference && result && (
            <span className="text-right text-xs leading-tight md:text-sm">
              <span className="text-muted-foreground">
                {t("teamOptimizer.vsCurrent")}{" "}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap font-bold tabular-nums",
                  change >= 0 ? "text-primary" : "text-destructive"
                )}
                data-vs-current
              >
                {formatChange(
                  result.report.perCycle,
                  reference.report.perCycle,
                  locale
                )}
              </span>
            </span>
          )}
        </div>
        <div className="order-1 flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-card/70 px-2 py-1.5 md:order-2 md:mx-3 md:gap-2.5 md:px-4 md:py-2">
          <CompactSelect
            label={t("teamOptimizer.critMode")}
            value={critMode}
            onValueChange={(value) => onCritModeChange(value as CritMode)}
            options={(Object.keys(CRIT_MODE_KEYS) as CritMode[]).map(
              (mode) => ({ value: mode, label: t(CRIT_MODE_KEYS[mode]) })
            )}
            className="h-5 border-0 bg-transparent px-0.5 text-xs font-semibold text-primary md:h-6 md:text-sm"
          />
          <button
            type="button"
            aria-expanded={result ? expanded : undefined}
            aria-controls={result ? bodyId : undefined}
            disabled={!result}
            onClick={() => setExpanded((value) => !value)}
            className="flex flex-wrap items-center justify-center gap-1.5 rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default md:gap-2.5"
          >
            <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold md:text-sm">
              {running && (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-muted-foreground"
                  role="status"
                  aria-label={t("combat.damage.running")}
                />
              )}
              {t("combat.damage.perCycle")}
            </span>
            <span
              className="text-2xl font-black tabular-nums md:text-3xl xl:text-4xl"
              data-damage-per-cycle
            >
              {result ? formatDamage(result.report.perCycle, locale) : "—"}
            </span>
            {result && (
              <span className="flex items-center gap-0.5 whitespace-nowrap text-[10px] text-muted-foreground md:text-xs">
                {expanded
                  ? t("teamOptimizer.collapse")
                  : t("teamOptimizer.expand")}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    expanded && "rotate-180"
                  )}
                  aria-hidden
                />
              </span>
            )}
          </button>
        </div>
        <div className="order-1 h-0 basis-full md:hidden" aria-hidden />
        <div className="order-3 flex min-w-0 justify-start empty:hidden md:flex-1 md:empty:flex">
          {result && (
            <span className="text-left text-[10px] leading-tight text-muted-foreground md:text-xs">
              <span className="lg:hidden">
                {t("combat.damage.total", {
                  cycles,
                  value: formatCompactDamage(total, locale),
                })}
              </span>
              <span className="hidden lg:inline">
                {t("combat.damage.total", {
                  cycles,
                  value: formatDamage(total, locale),
                })}
              </span>
            </span>
          )}
        </div>
      </div>
      {expanded && result && (
        <div id={bodyId}>
          <Breakdown result={result} />
        </div>
      )}
    </div>
  );
}
