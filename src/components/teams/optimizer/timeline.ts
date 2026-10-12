import type { SimulateResponse, TimelineAction } from "@/services/combat/jobs";

/** One read-only action chip on a cycle rail. */
export interface TimelineChip {
  /** Position in the whole battle log (stable key). */
  readonly index: number;
  readonly action: TimelineAction;
  /** Skill Point change since the previous action (or the battle start). */
  readonly skillPointDelta: number | null;
  /**
   * Energy change of the acting Character since its previous action; null for
   * its first action, for memosprites and summons, and for Characters whose
   * Ultimate is paid with a kit resource instead of Energy.
   */
  readonly energyDelta: number | null;
}

/** The actions of one cycle with that cycle's damage. */
export interface TimelineRail {
  /** 0-based, as in `DamageReport.byCycle`. */
  readonly cycle: number;
  readonly damage: number;
  readonly chips: readonly TimelineChip[];
  /** Skill Points after the cycle's last action; null for an empty cycle. */
  readonly skillPointsAfter: number | null;
}

/** Per-member totals over the whole battle. */
export interface MemberTimelineSummary {
  readonly slot: number;
  /** Ultimates the Character used. */
  readonly ultimates: number;
  /** Every action credited to the slot (memosprite actions included). */
  readonly actions: number;
  /**
   * Energy after the Character's last action; null when it never acted or
   * its Ultimate does not use Energy.
   */
  readonly energy: number | null;
}

/** Changes smaller than this are rounding noise from weighted branches. */
const EPSILON = 0.05;

function roundDelta(value: number): number | null {
  if (Math.abs(value) < EPSILON) return null;
  return Math.round(value * 10) / 10;
}

/** Team slots whose Ultimate is paid with Energy. */
function energySlots(result: SimulateResponse): Set<number> {
  return new Set(
    result.members
      .filter((member) => member.ultimateEnergy !== false)
      .map((member) => member.slot)
  );
}

/** Splits the battle log into one rail per cycle, with SP and Energy deltas. */
export function timelineRails(result: SimulateResponse): TimelineRail[] {
  const cycles = Math.max(
    result.report.byCycle.length,
    ...result.actions.map((action) => action.cycle + 1)
  );
  const rails = Array.from({ length: cycles }, (_, cycle) => ({
    cycle,
    damage: result.report.byCycle[cycle] ?? 0,
    chips: [] as TimelineChip[],
    skillPointsAfter: null as number | null,
  }));
  const energy = energySlots(result);
  const lastEnergy = new Map<string, number>();
  let lastSkillPoints: number | null = result.startingSkillPoints ?? null;
  result.actions.forEach((action, index) => {
    const skillPointDelta =
      lastSkillPoints === null
        ? null
        : roundDelta(action.skillPointsAfter - lastSkillPoints);
    lastSkillPoints = action.skillPointsAfter;
    let energyDelta: number | null = null;
    if (action.unitKind === "character" && energy.has(action.slot)) {
      const previous = lastEnergy.get(action.unitId);
      if (previous !== undefined)
        energyDelta = roundDelta(action.energyAfter - previous);
      lastEnergy.set(action.unitId, action.energyAfter);
    }
    const rail = rails[Math.min(cycles - 1, Math.max(0, action.cycle))];
    if (!rail) return;
    rail.chips.push({ index, action, skillPointDelta, energyDelta });
    rail.skillPointsAfter = action.skillPointsAfter;
  });
  return rails;
}

/** Ultimates, action counts and final Energy per team slot. */
export function memberTimelineSummaries(
  result: SimulateResponse
): Map<number, MemberTimelineSummary> {
  const energy = energySlots(result);
  const summaries = new Map<number, MemberTimelineSummary>();
  for (const member of result.members)
    summaries.set(member.slot, {
      slot: member.slot,
      ultimates: 0,
      actions: 0,
      energy: null,
    });
  for (const action of result.actions) {
    const summary = summaries.get(action.slot);
    if (!summary) continue;
    const own = action.unitKind === "character";
    summaries.set(action.slot, {
      slot: summary.slot,
      actions: summary.actions + 1,
      ultimates:
        summary.ultimates + (own && action.mode === "ultimate" ? 1 : 0),
      energy:
        own && energy.has(action.slot) ? action.energyAfter : summary.energy,
    });
  }
  return summaries;
}

/** "+1", "−0.5": a signed delta with a typographic minus. */
export function formatSignedDelta(value: number, locale: string): string {
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  return value >= 0 ? `+${formatted}` : `−${formatted}`;
}
