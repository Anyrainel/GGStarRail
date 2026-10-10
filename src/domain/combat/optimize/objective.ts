import type { BattleOptions } from "../battle/battle";
import type { CombatUnit } from "../battle/units";
import {
  DamageModel,
  type HitGroup,
  type UnitPanels,
} from "../evaluate/damage";
import { buildDamageReport, type DamageReport } from "../evaluate/report";
import type { KitRegistry } from "../kit/registry";
import type { CombatReferenceData } from "../model/data";
import type { CritMode } from "../model/formulas";
import {
  type CombatStat,
  type CombatType,
  finalStat,
  readStat,
  type StatVector,
} from "../model/stats";
import {
  assembleTeam,
  relicElementalBoost,
  relicVector,
} from "../team/assemble";
import type { RelicLoadout, TeamInput } from "../team/input";
import { setSignature } from "./relics";

export interface ObjectiveOptions {
  /** Whose damage counts: the whole team (default) or one member's slot. */
  readonly target?: "team" | number;
  readonly critMode?: CritMode;
  readonly battle?: Partial<BattleOptions>;
  /** Simulated timelines kept in memory. */
  readonly cacheSize?: number;
}

interface TimelineContext {
  readonly model: DamageModel;
  readonly units: Map<string, CombatUnit>;
  readonly unitId: string;
}

interface SetContext {
  readonly panelWithoutRelics: StatVector;
}

/** Final panel of the optimized member: the values constraints read. */
export interface MemberPanel {
  readonly vector: StatVector;
  readonly speed: number;
  readonly energyRegen: number;
}

/** Stats that always shape a timeline: turn order and Energy. */
const TIMELINE_STATS = ["spd", "energyRegen"] as const;

type TimelineStat = CombatStat | "hp" | "atk" | "def" | "spd";

/**
 * Damage of a team as a function of one member's Relics. A simulated
 * timeline only depends on the member's active sets and on the stats the
 * battle read while it ran: SPD and Energy Regeneration Rate always, plus
 * any stat a kit or the engine consulted (Break Effect for break delays, a
 * policy comparing allies' stats). Timelines are cached by those values and
 * every other candidate re-evaluates the compiled hit ledger with a
 * swapped panel.
 */
export class TeamObjective {
  private readonly timelines = new Map<string, TimelineContext>();
  private readonly setContexts = new Map<string, SetContext>();
  /** Stats besides SPD and ERR that simulations of this member read. */
  private readonly readStats = new Set<TimelineStat>();
  evaluations = 0;
  simulations = 0;

  constructor(
    readonly input: TeamInput,
    readonly slot: number,
    private readonly data: CombatReferenceData,
    private readonly kits: KitRegistry,
    private readonly options: ObjectiveOptions = {}
  ) {
    if (!input.members[slot]) throw new Error(`No team member in slot ${slot}`);
  }

  withLoadout(loadout: RelicLoadout): TeamInput {
    return {
      ...this.input,
      members: this.input.members.map((member, index) =>
        index === this.slot ? { ...member, relics: loadout } : member
      ),
    };
  }

  /** The member's final panel stats for a loadout (no simulation). */
  memberPanel(loadout: RelicLoadout): MemberPanel {
    const base = this.setContext(loadout).panelWithoutRelics;
    const relic = relicVector(loadout).vector;
    const vector = base.slice();
    for (let index = 0; index < vector.length; index += 1) {
      vector[index] = (vector[index] ?? 0) + (relic[index] ?? 0);
    }
    return {
      vector,
      speed: finalStat(vector, "spd"),
      energyRegen: readStat(vector, "energyRegen"),
    };
  }

  evaluate(loadout: RelicLoadout): number {
    this.evaluations += 1;
    const { context, panels } = this.prepare(loadout);
    const target = this.options.target ?? "team";
    if (target === "team") return context.model.total(panels);
    return context.model.total(
      panels,
      (group) => creditedSlot(group, context.units) === target
    );
  }

  report(loadout: RelicLoadout): DamageReport {
    const { context, panels } = this.prepare(loadout);
    return buildDamageReport(
      context.model,
      panels,
      context.units,
      context.model.log
    );
  }

  private prepare(loadout: RelicLoadout): {
    context: TimelineContext;
    panels: UnitPanels;
  } {
    const member = this.memberPanel(loadout);
    let key = this.timelineKey(loadout, member.vector);
    let context = this.timelines.get(key);
    if (!context) {
      context = this.simulate(loadout);
      if (this.learnReadStats(context)) {
        // Older entries were keyed without the newly read stats.
        this.timelines.clear();
        key = this.timelineKey(loadout, member.vector);
      }
      this.timelines.set(key, context);
      const limit = this.options.cacheSize ?? 256;
      if (this.timelines.size > limit) {
        const oldest = this.timelines.keys().next().value;
        if (oldest !== undefined) this.timelines.delete(oldest);
      }
    }
    const elemental = relicElementalBoost(loadout);
    const units = context.units;
    const unitId = context.unitId;
    const panels: UnitPanels = {
      panel: (id) =>
        id === unitId ? member.vector : (units.get(id)?.panel ?? member.vector),
      elemental: (id, combatType: CombatType) =>
        id === unitId
          ? (elemental[combatType] ?? 0)
          : (units.get(id)?.relicElemental[combatType] ?? 0),
    };
    return { context, panels };
  }

  private timelineKey(loadout: RelicLoadout, vector: StatVector): string {
    const parts = [setSignature(loadout.sets)];
    for (const stat of [...TIMELINE_STATS, ...this.readStats]) {
      const value =
        stat === "hp" || stat === "atk" || stat === "def" || stat === "spd"
          ? finalStat(vector, stat)
          : readStat(vector, stat);
      parts.push(value.toFixed(stat === "spd" ? 2 : 3));
    }
    return parts.join("|");
  }

  /** Record stats the member's units read; true when the set grew. */
  private learnReadStats(context: TimelineContext): boolean {
    const member = context.units.get(context.unitId);
    if (!member) return false;
    let grew = false;
    for (const unit of context.units.values()) {
      const sharesPanel =
        unit === member ||
        (unit.kind === "memosprite" && unit.owner === member);
      if (!sharesPanel) continue;
      for (const stat of unit.statReads) {
        const known = (TIMELINE_STATS as readonly string[]).includes(stat);
        if (known || this.readStats.has(stat as TimelineStat)) continue;
        this.readStats.add(stat as TimelineStat);
        grew = true;
      }
    }
    return grew;
  }

  private setContext(loadout: RelicLoadout): SetContext {
    const signature = setSignature(loadout.sets);
    let context = this.setContexts.get(signature);
    if (!context) {
      const team = assembleTeam(
        this.withLoadout({ stats: {}, sets: loadout.sets }),
        this.data,
        this.kits,
        this.options.battle
      );
      const member = team.members[this.slot];
      if (!member) throw new Error(`No assembled member in slot ${this.slot}`);
      context = { panelWithoutRelics: member.panelWithoutRelics };
      this.setContexts.set(signature, context);
    }
    return context;
  }

  private simulate(loadout: RelicLoadout): TimelineContext {
    this.simulations += 1;
    const team = assembleTeam(
      this.withLoadout(loadout),
      this.data,
      this.kits,
      this.options.battle
    );
    const log = team.battle.run();
    const units = team.units();
    const model = new DamageModel(
      log,
      units,
      team.enemyMap(),
      this.options.critMode ?? "expected"
    );
    return { model, units, unitId: `ally:${this.slot}` };
  }
}

function creditedSlot(group: HitGroup, units: Map<string, CombatUnit>): number {
  const unit =
    units.get(group.sample.attackerId) ?? units.get(group.sample.statUnitId);
  return unit?.slot ?? -1;
}
