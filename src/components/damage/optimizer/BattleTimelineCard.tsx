import { ListOrdered, Loader2, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import type { SimulateResponse } from "@/lib/combat/jobs";
import { actionLabel, formatDamage } from "@/lib/combat/presentation";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "../team/MemberAvatar";
import { ProgressBar } from "../team/MemberProgress";
import { InlineEmptyBox } from "../team/StatusBoxes";
import { TeamCharacterGrid } from "../team/TeamCharacterGrid";
import { useTeamDmgData } from "../team/TeamDmgData";
import { TeamSectionCard } from "../team/TeamSectionCard";
import {
  formatSignedDelta,
  memberTimelineSummaries,
  type TimelineChip,
  type TimelineRail,
  timelineRails,
} from "./timeline";

function Tag({ children }: { children: string }) {
  return (
    <span className="whitespace-nowrap rounded bg-muted px-1 font-mono text-[10px] leading-4 text-foreground">
      {children}
    </span>
  );
}

function ActionChip({
  chip,
  characterId,
}: {
  chip: TimelineChip;
  /** The acting slot's Character; null for summons without a slot. */
  characterId: string | null;
}) {
  const { locale, t } = useI18n();
  const { action } = chip;
  const label = actionLabel(action.abilityKind, t);
  const ultimate = action.mode === "ultimate";
  const skill = action.abilityKind === "skill";
  const actionValue = t("combat.timeline.actionValue", {
    value: action.time.toFixed(1),
  });
  const skillPoints = t("combat.timeline.skillPoints", {
    value: Math.round(action.skillPointsAfter * 10) / 10,
  });
  return (
    <li
      className="relative shrink-0 rounded-md bg-card after:pointer-events-none after:absolute after:left-full after:top-1/2 after:h-0.5 after:w-2 after:-translate-y-1/2 after:bg-border last:after:hidden lg:after:hidden"
      title={`${label} · ${actionValue} · ${skillPoints}`}
      data-timeline-action={action.abilityKind}
      data-ultimate={ultimate || undefined}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-2 py-0.5",
          ultimate && "border-primary/60 bg-primary/10",
          skill && !ultimate && "bg-secondary"
        )}
      >
        {characterId ? (
          <MemberAvatar characterId={characterId} size="xs" decorative />
        ) : (
          <Sparkles
            className="h-[18px] w-[18px] shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
        <span className="text-xs md:text-sm">{label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {actionValue}
        </span>
        {chip.skillPointDelta !== null && (
          <Tag>
            {t("combat.timeline.skillPoints", {
              value: formatSignedDelta(chip.skillPointDelta, locale),
            })}
          </Tag>
        )}
        {chip.energyDelta !== null && (
          <Tag>
            {t("teamOptimizer.timeline.energyTag", {
              value: formatSignedDelta(chip.energyDelta, locale),
            })}
          </Tag>
        )}
      </div>
    </li>
  );
}

function CycleRail({
  rail,
  characterBySlot,
}: {
  rail: TimelineRail;
  characterBySlot: ReadonlyMap<number, string>;
}) {
  const { locale, t } = useI18n();
  const label = t("combat.damage.cycleLabel", { index: rail.cycle + 1 });
  return (
    <section
      aria-label={label}
      className="mx-2 my-2 overflow-hidden rounded-lg border border-border"
      data-timeline-rail={rail.cycle + 1}
    >
      <div className="flex justify-between gap-2 border-b border-border px-3 py-1.5 text-xs">
        <span className="font-semibold">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {formatDamage(rail.damage, locale)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-fit px-2 py-2 md:px-4 lg:min-w-0">
          <ol className="flex items-center gap-2 lg:flex-wrap lg:gap-y-2">
            {rail.chips.map((chip) => (
              <ActionChip
                key={chip.index}
                chip={chip}
                characterId={characterBySlot.get(chip.action.slot) ?? null}
              />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Summary({ result }: { result: SimulateResponse }) {
  const { locale, t } = useI18n();
  const { lookup, references } = useTeamDmgData();
  const summaries = memberTimelineSummaries(result);
  const speed = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return (
    <TeamCharacterGrid className="p-2" gridClassName="gap-1.5 lg:gap-1.5">
      {result.members.map((member) => {
        const summary = summaries.get(member.slot);
        const name =
          lookup.characters.get(member.characterId)?.name ?? member.characterId;
        const maxEnergy =
          references.characters.byId.get(member.characterId)?.max_energy ?? 0;
        const energy = summary?.energy ?? null;
        return (
          <div
            key={member.slot}
            className="flex min-w-0 flex-col gap-1 rounded-md border border-border p-2 text-xs"
            data-timeline-member={member.slot}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <MemberAvatar characterId={member.characterId} decorative />
              <span className="min-w-0 truncate font-bold md:text-sm">
                {name}
              </span>
              <span className="ml-auto shrink-0 font-mono tabular-nums">
                {t("teamOptimizer.timeline.ultimates", {
                  count: summary?.ultimates ?? 0,
                })}
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-x-2 text-muted-foreground">
              <span>
                {t("teamOptimizer.timeline.actions", {
                  count: summary?.actions ?? 0,
                })}
              </span>
              <span className="tabular-nums">
                {t("stat.short.spd")} {speed.format(member.panel.spd)}
              </span>
            </div>
            {energy !== null && maxEnergy > 0 && (
              <div className="flex items-center gap-2">
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {t("teamOptimizer.timeline.energy", {
                    value: whole.format(energy),
                    max: whole.format(maxEnergy),
                  })}
                </span>
                <ProgressBar
                  value={energy / maxEnergy}
                  label={t("teamOptimizer.timeline.energy", {
                    value: whole.format(energy),
                    max: whole.format(maxEnergy),
                  })}
                />
              </div>
            )}
          </div>
        );
      })}
    </TeamCharacterGrid>
  );
}

/**
 * The simulated battle, one rail of read-only action chips per cycle, with
 * Skill Point and Energy changes on each action and per-member totals.
 */
export function BattleTimelineCard({
  result,
  running,
}: {
  result: SimulateResponse | null;
  running: boolean;
}) {
  const { locale, t } = useI18n();
  const rails = result ? timelineRails(result) : [];
  const characterBySlot = new Map(
    (result?.members ?? []).map((member) => [member.slot, member.characterId])
  );
  const spFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return (
    <TeamSectionCard
      icon={ListOrdered}
      title={t("teamOptimizer.timeline.title")}
      collapsible
      defaultOpen={false}
      bodyClassName="max-h-[65vh] overflow-y-auto p-0 2xl:p-0"
      data-section="battle-timeline"
    >
      {!result ? (
        running ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
          >
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            {t("combat.damage.running")}
          </div>
        ) : (
          <InlineEmptyBox icon={ListOrdered} className="m-2">
            {t("teamOptimizer.noMembers")}
          </InlineEmptyBox>
        )
      ) : (
        <>
          {rails.map((rail) => (
            <CycleRail
              key={rail.cycle}
              rail={rail}
              characterBySlot={characterBySlot}
            />
          ))}
          <Summary result={result} />
          {rails.some((rail) => rail.skillPointsAfter !== null) && (
            <div
              className="mx-2 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-1.5 text-xs"
              data-timeline-skill-points
            >
              <span className="font-semibold">
                {t("teamOptimizer.timeline.skillPoints")}
              </span>
              {rails.map((rail) =>
                rail.skillPointsAfter === null ? null : (
                  <span key={rail.cycle} className="whitespace-nowrap">
                    <span className="text-muted-foreground">
                      {t("combat.damage.cycleLabel", { index: rail.cycle + 1 })}
                    </span>{" "}
                    <span className="font-mono font-bold tabular-nums">
                      {spFormat.format(rail.skillPointsAfter)}
                    </span>
                  </span>
                )
              )}
            </div>
          )}
        </>
      )}
    </TeamSectionCard>
  );
}
