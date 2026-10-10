import { Loader2 } from "lucide-react";
import { StatusBanner } from "@/components/builds/StatusBanner";
import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nContext";
import type { BuildReferences } from "@/lib/buildReferences";
import { characterCatalogName } from "@/lib/catalogPresentation";
import type { SimulateResponse } from "@/lib/combat/jobs";
import {
  abilityDamageLabel,
  actionLabel,
  formatCompactDamage,
  formatDamage,
  formatPercent,
} from "@/lib/combat/presentation";
import { cn } from "@/lib/utils";

interface DamageSummaryProps {
  result: SimulateResponse | null;
  running: boolean;
  failed: boolean;
  cycles: number;
  references: BuildReferences;
}

function ShareBar({ share }: { share: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }}
      />
    </div>
  );
}

export function DamageSummary({
  result,
  running,
  failed,
  cycles,
  references,
}: DamageSummaryProps) {
  const { locale, t } = useI18n();
  const trailblazer = t("terms.trailblazer");
  const memberBySlot = new Map(
    (result?.members ?? []).map((member) => [member.slot, member])
  );

  function MemberIcon({ slot }: { slot: number }) {
    const member = memberBySlot.get(slot);
    const character = member
      ? references.characters.byId.get(member.characterId)
      : undefined;
    if (!character) return <span className="h-10 w-10 shrink-0" />;
    return (
      <ItemIcon
        kind="character"
        id={character.id}
        sourcePath={character.icon_path}
        rarity={character.rarity}
        size="xs"
        alt={characterCatalogName(character, locale, trailblazer)}
        className="shrink-0"
      />
    );
  }

  function memberName(slot: number): string {
    const member = memberBySlot.get(slot);
    const character = member
      ? references.characters.byId.get(member.characterId)
      : undefined;
    return character
      ? characterCatalogName(character, locale, trailblazer)
      : t("combat.timeline.aha");
  }

  // Rows with the same visible label (e.g. two Basic ATK variants) merge.
  const abilityRows = new Map<
    string,
    { slot: number; label: string; damage: number }
  >();
  for (const entry of result?.report.abilities ?? []) {
    const label = abilityDamageLabel(entry, t);
    const key = `${entry.slot}|${label}`;
    const row = abilityRows.get(key);
    abilityRows.set(key, {
      slot: entry.slot,
      label,
      damage: (row?.damage ?? 0) + entry.damage,
    });
  }
  const total = result?.report.total ?? 0;
  const byCycle = result?.report.byCycle ?? [];
  const peakCycle = Math.max(1, ...byCycle);

  return (
    <Card className="min-w-0 bg-gradient-card" data-damage-summary>
      <CardHeader className="flex-row flex-wrap items-end justify-between gap-3 space-y-0 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("combat.damage.perCycle")}
          </h2>
          <p
            className="text-3xl font-semibold tabular-nums"
            data-damage-per-cycle
          >
            {result ? formatDamage(result.report.perCycle, locale) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("combat.damage.total", {
              cycles,
              value: result ? formatDamage(total, locale) : "—",
            })}
          </p>
        </div>
        {running && (
          <span
            role="status"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("combat.damage.running")}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        {failed && (
          <StatusBanner message={t("combat.damage.failed")} tone="error" />
        )}
        {result && result.warnings.length > 0 && (
          <StatusBanner message={t("combat.damage.warning")} />
        )}
        {result && (
          <>
            <section
              aria-label={t("combat.damage.byMember")}
              className="space-y-2"
            >
              <h3 className="text-xs font-semibold text-muted-foreground">
                {t("combat.damage.byMember")}
              </h3>
              {result.report.members.map((entry) => (
                <div key={entry.slot} className="flex items-center gap-2">
                  <MemberIcon slot={entry.slot} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate">{memberName(entry.slot)}</span>
                      <span className="shrink-0 tabular-nums">
                        {formatPercent(entry.share, locale)}
                      </span>
                    </div>
                    <ShareBar share={entry.share} />
                  </div>
                </div>
              ))}
            </section>

            <section
              aria-label={t("combat.damage.byAbility")}
              className="space-y-1"
            >
              <h3 className="text-xs font-semibold text-muted-foreground">
                {t("combat.damage.byAbility")}
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {[...abilityRows.values()]
                    .sort((left, right) => right.damage - left.damage)
                    .map((row) => (
                      <tr
                        key={`${row.slot}|${row.label}`}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-1 pr-2 text-muted-foreground">
                          {memberName(row.slot)}
                        </td>
                        <td className="py-1 pr-2">{row.label}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {formatCompactDamage(row.damage, locale)}
                        </td>
                        <td className="w-14 py-1 text-right tabular-nums text-muted-foreground">
                          {formatPercent(
                            total > 0 ? row.damage / total : 0,
                            locale,
                            0
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>

            {byCycle.length > 1 && (
              <section
                aria-label={t("combat.damage.byCycle")}
                className="space-y-1"
              >
                <h3 className="text-xs font-semibold text-muted-foreground">
                  {t("combat.damage.byCycle")}
                </h3>
                <div className="flex h-16 items-end gap-1">
                  {byCycle.map((damage, index) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: cycles are positional
                      key={index}
                      className="flex-1 rounded-t bg-primary/70"
                      style={{ height: `${(damage / peakCycle) * 100}%` }}
                      title={`${t("combat.damage.cycleLabel", { index })} · ${formatDamage(damage, locale)}`}
                    />
                  ))}
                </div>
              </section>
            )}

            <Accordion type="single" collapsible>
              <AccordionItem value="timeline" className="border-0">
                <AccordionTrigger className="py-2 text-xs">
                  {t("combat.timeline.title")}
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="max-h-80 space-y-0.5 overflow-y-auto text-xs">
                    {result.actions.map((action, index) => (
                      <li
                        // biome-ignore lint/suspicious/noArrayIndexKey: the log is append-only
                        key={index}
                        className={cn(
                          "grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)_3rem] gap-2 rounded px-1 py-0.5",
                          action.mode === "ultimate" && "bg-primary/10"
                        )}
                      >
                        <span className="tabular-nums text-muted-foreground">
                          {t("combat.timeline.actionValue", {
                            value: action.time.toFixed(1),
                          })}
                        </span>
                        <span className="truncate">
                          {memberName(action.slot)}
                        </span>
                        <span className="truncate">
                          {actionLabel(action.abilityKind, t)}
                        </span>
                        <span className="text-right tabular-nums text-muted-foreground">
                          {t("combat.timeline.skillPoints", {
                            value:
                              Math.round(action.skillPointsAfter * 10) / 10,
                          })}
                        </span>
                      </li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </>
        )}
      </CardContent>
    </Card>
  );
}
