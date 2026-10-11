import type { BuildConfiguration } from "@/domain/build/schemas";
import { DEFAULT_BATTLE_OPTIONS } from "@/domain/combat/battle/battle";
import type { ActionRecord } from "@/domain/combat/battle/log";
import type { CombatUnit } from "@/domain/combat/battle/units";
import type { DamageReport } from "@/domain/combat/evaluate/report";
import type { KitRegistry } from "@/domain/combat/kit/registry";
import type { CombatReferenceData } from "@/domain/combat/model/data";
import type { CritMode } from "@/domain/combat/model/formulas";
import {
  type CombatType,
  finalStat,
  readStat,
} from "@/domain/combat/model/stats";
import type { UnitKind } from "@/domain/combat/model/tags";
import {
  compareLightCones,
  compareSetPlans,
  deriveStatWeights,
  type InvestmentStep,
  investmentPath,
} from "@/domain/combat/optimize/analysis";
import {
  type ConfigurableSlot,
  generateIdealRelics,
  type StatConstraints,
  type SubstatBudget,
} from "@/domain/combat/optimize/idealRelics";
import { TeamObjective } from "@/domain/combat/optimize/objective";
import { searchRelics } from "@/domain/combat/optimize/relicSearch";
import {
  loadoutOf,
  type RelicPiece,
  type RelicTables,
  type SetPlan,
  type SixPieces,
} from "@/domain/combat/optimize/relics";
import { simulateTeam } from "@/domain/combat/simulate";
import {
  assembleTeam,
  type MemberOptionGroup,
} from "@/domain/combat/team/assemble";
import type { TeamInput } from "@/domain/combat/team/input";
import {
  loadProgression,
  loadPropertyTables,
  loadRelicPieces,
} from "@/providers/reference/catalog";
import type { TeamPlan } from "@/stores/teamSchemas";
import { type PropertyKinds, relicPiece } from "./accountTeam";
import { KIT_REGISTRY } from "./kits";
import { loadCombatReferenceData } from "./referenceData";
import { buildRelicTables } from "./relicTables";
import {
  type BuildSources,
  type ResolvedMember,
  resolveTeam,
  type ValueOrigin,
} from "./resolve";

export interface CombatCatalog {
  readonly data: CombatReferenceData;
  readonly tables: RelicTables;
  readonly kits: KitRegistry;
  readonly properties: PropertyKinds;
  readonly presetBuilds: readonly BuildConfiguration[];
  readonly presetLightConeIds: Readonly<Record<string, readonly string[]>>;
}

export async function loadCombatCatalog(): Promise<CombatCatalog> {
  const [data, progression, pieces, propertyTables, presets] =
    await Promise.all([
      loadCombatReferenceData(),
      loadProgression(),
      loadRelicPieces(),
      loadPropertyTables(),
      import("@/presets/builds/in-game.json"),
    ]);
  const preset = presets.default as unknown as {
    builds: BuildConfiguration[];
    characterLightConeIds: Record<string, string[]>;
  };
  return {
    data,
    tables: buildRelicTables(progression, pieces.values),
    kits: KIT_REGISTRY,
    properties: propertyTables.propertyById,
    presetBuilds: preset.builds,
    presetLightConeIds: preset.characterLightConeIds,
  };
}

/** Workspace-side inputs sent with every request. */
export type WorkspaceSources = Pick<
  BuildSources,
  "account" | "characterLightConeIds" | "builds"
>;

/** Main stats allowed per variable slot (Body, Feet, Planar Sphere, Link Rope). */
export type MainStatChoices = Partial<
  Record<ConfigurableSlot, readonly string[]>
>;

export interface TeamRequest {
  readonly team: TeamPlan;
  readonly sources: WorkspaceSources;
  readonly critMode?: CritMode;
  readonly budget?: SubstatBudget;
  /**
   * Account Relics to wear instead of the member's resolved Relics, by team
   * slot and Relic slot (e.g. every member's optimized loadout at once).
   */
  readonly relicOverrides?: Readonly<
    Record<number, Readonly<Record<string, string>>>
  >;
}

export interface MemberPanelSummary {
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly spd: number;
  readonly critRate: number;
  readonly critDmg: number;
  readonly breakEffect: number;
  readonly outgoingHealing: number;
  readonly energyRegen: number;
  readonly effectHitRate: number;
  readonly effectRes: number;
  /** The member's own Combat Type, which {@link combatTypeDmg} boosts. */
  readonly combatType: CombatType;
  /**
   * DMG Boost of the member's own Combat Type as the in-game panel shows it:
   * Planar Sphere main stat, Traces, set bonuses and other permanent bonuses
   * limited to that Combat Type.
   */
  readonly combatTypeDmg: number;
  readonly elation: number;
}

/** Whether a permanent modifier only narrows its bonus to `combatType`. */
function boostsCombatType(
  modifier: CombatUnit["conditional"][number],
  combatType: CombatType
): boolean {
  const { def } = modifier;
  if (def.stat !== "dmgBoost" || def.scaling || !def.filter) return false;
  const { combatTypes, ...rest } = def.filter;
  return (
    (combatTypes?.includes(combatType) ?? false) &&
    Object.values(rest).every((value) => value === undefined)
  );
}

function panelSummary(unit: CombatUnit): MemberPanelSummary {
  const panel = unit.panel;
  const combatType = unit.combatType;
  let combatTypeDmg = unit.relicElemental[combatType] ?? 0;
  for (const modifier of unit.conditional)
    if (boostsCombatType(modifier, combatType))
      combatTypeDmg += (modifier.def.value ?? 0) * modifier.scale;
  return {
    hp: finalStat(panel, "hp"),
    atk: finalStat(panel, "atk"),
    def: finalStat(panel, "def"),
    spd: finalStat(panel, "spd"),
    critRate: readStat(panel, "critRate"),
    critDmg: readStat(panel, "critDmg"),
    breakEffect: readStat(panel, "breakEffect"),
    outgoingHealing: readStat(panel, "outgoingHealing"),
    energyRegen: readStat(panel, "energyRegen"),
    effectHitRate: readStat(panel, "effectHitRate"),
    effectRes: readStat(panel, "effectRes"),
    combatType,
    combatTypeDmg,
    elation: readStat(panel, "elation"),
  };
}

export interface MemberOutcome {
  readonly slot: number;
  readonly characterId: string;
  readonly level: number;
  readonly eidolon: number;
  readonly owned: boolean;
  readonly lightCone: TeamInput["members"][number]["lightCone"];
  readonly lightConeOrigin: ValueOrigin;
  readonly relicSource: "equipped" | "ideal";
  readonly setPlan: SetPlan;
  readonly setPlanOrigin: ValueOrigin;
  readonly ideal: {
    readonly mainStats: Readonly<Record<string, string>>;
    readonly rolls: Readonly<Record<string, number>>;
  } | null;
  readonly panel: MemberPanelSummary;
  /** False when a kit resource (e.g. Slashed Dream) pays for the Ultimate. */
  readonly ultimateEnergy: boolean;
  readonly optionGroups: readonly MemberOptionGroup[];
  readonly implemented: {
    readonly character: boolean;
    readonly lightCone: boolean | null;
    readonly relicSets: Readonly<Record<string, boolean>>;
  };
}

/** One action, credited to the team slot whose unit took it. */
export interface TimelineAction extends ActionRecord {
  readonly slot: number;
  readonly unitKind: UnitKind;
}

export interface SimulateResponse {
  readonly members: readonly MemberOutcome[];
  readonly report: DamageReport;
  readonly actions: readonly TimelineAction[];
  /** Skill Points before the first action. */
  readonly startingSkillPoints: number;
  readonly warnings: readonly string[];
}

interface PreparedTeam {
  readonly resolved: readonly ResolvedMember[];
  readonly input: TeamInput;
  readonly ideals: Map<
    number,
    { mainStats: Record<string, string>; rolls: Record<string, number> }
  >;
}

function slotOf(members: readonly ResolvedMember[], index: number): number {
  return members[index]?.slot ?? index;
}

/** Resolve defaults and generate ideal Relics for members without gear. */
export function prepareTeam(
  catalog: CombatCatalog,
  request: TeamRequest
): PreparedTeam {
  const resolvedTeam = resolveTeam(
    request.team,
    {
      ...request.sources,
      presetBuilds: catalog.presetBuilds,
      presetLightConeIds: catalog.presetLightConeIds,
    },
    catalog.properties
  );
  const resolved = resolvedTeam.members;
  let input: TeamInput = {
    members: resolved.map((member) => member.input),
    scenario: resolvedTeam.scenario,
  };
  const overridden = new Set<number>();
  const overrides = request.relicOverrides ?? {};
  const account = request.sources.account;
  if (account) {
    const relics = new Map(account.relics.map((relic) => [relic.key, relic]));
    resolved.forEach((member, index) => {
      const keys = overrides[member.slot];
      if (!keys) return;
      const pieces: Partial<Record<RelicPiece["slot"], RelicPiece>> = {};
      for (const key of Object.values(keys)) {
        const relic = relics.get(key);
        if (relic) pieces[relic.slot] = relicPiece(relic, catalog.properties);
      }
      if (!Object.keys(pieces).length) return;
      overridden.add(member.slot);
      const loadout = loadoutOf(pieces as SixPieces);
      input = {
        ...input,
        members: input.members.map((entry, position) =>
          position === index ? { ...entry, relics: loadout } : entry
        ),
      };
    });
  }
  const ideals: PreparedTeam["ideals"] = new Map();
  resolved.forEach((member, index) => {
    if (member.relicSource !== "ideal" || overridden.has(member.slot)) return;
    if (!catalog.data.characters.has(member.input.characterId)) return;
    const objective = new TeamObjective(
      input,
      index,
      catalog.data,
      catalog.kits,
      {
        critMode: request.critMode,
      }
    );
    const ideal = generateIdealRelics(objective, catalog.tables, {
      plan: member.setPlan,
      budget: request.budget ?? "realistic",
      mainStats: member.mainStats,
      finalists: 2,
    });
    ideals.set(member.slot, { mainStats: ideal.mainStats, rolls: ideal.rolls });
    input = {
      ...input,
      members: input.members.map((entry, position) =>
        position === index ? { ...entry, relics: ideal.loadout } : entry
      ),
    };
  });
  return { resolved, input, ideals };
}

export function simulateJob(
  catalog: CombatCatalog,
  request: TeamRequest
): SimulateResponse {
  const prepared = prepareTeam(catalog, request);
  if (prepared.input.members.length === 0) {
    return {
      members: [],
      report: {
        total: 0,
        perCycle: 0,
        duration: 0,
        members: [],
        abilities: [],
        byCycle: [],
      },
      actions: [],
      startingSkillPoints: DEFAULT_BATTLE_OPTIONS.startingSkillPoints,
      warnings: [],
    };
  }
  const result = simulateTeam(prepared.input, catalog.data, catalog.kits, {
    critMode: request.critMode,
  });
  const units = result.team.units();
  const members: MemberOutcome[] = result.team.members.map(
    (assembled, index) => {
      const resolved = prepared.resolved[index];
      if (!resolved) throw new Error(`Missing resolved member ${index}`);
      const ultimate = assembled.unit.behaviour?.abilities.get("ultimate");
      return {
        slot: resolved.slot,
        characterId: resolved.input.characterId,
        level: resolved.input.level,
        eidolon: resolved.input.eidolon,
        owned: resolved.owned,
        lightCone: resolved.input.lightCone,
        lightConeOrigin: resolved.lightConeOrigin,
        relicSource: resolved.relicSource,
        setPlan: resolved.setPlan,
        setPlanOrigin: resolved.setPlanOrigin,
        ideal: prepared.ideals.get(resolved.slot) ?? null,
        panel: panelSummary(assembled.unit),
        ultimateEnergy: !ultimate?.resource,
        optionGroups: assembled.optionGroups,
        implemented: assembled.implemented,
      };
    }
  );
  const report: DamageReport = {
    ...result.report,
    members: result.report.members.map((entry) => ({
      ...entry,
      slot: slotOf(prepared.resolved, entry.slot),
    })),
    abilities: result.report.abilities.map((entry) => ({
      ...entry,
      slot: slotOf(prepared.resolved, entry.slot),
    })),
  };
  return {
    members,
    report,
    actions: result.log.actions.map((action) => {
      const unit = units.get(action.unitId);
      return {
        ...action,
        slot:
          unit && unit.slot >= 0 ? slotOf(prepared.resolved, unit.slot) : -1,
        unitKind: unit?.kind ?? "summon",
      };
    }),
    startingSkillPoints: result.team.battle.options.startingSkillPoints,
    warnings: [...result.log.warnings],
  };
}

function memberIndex(prepared: PreparedTeam, slot: number): number {
  const index = prepared.resolved.findIndex((member) => member.slot === slot);
  if (index < 0) throw new Error(`No team member in slot ${slot}`);
  return index;
}

/**
 * One member's Relic search. Teammates wear their resolved Relics or, with
 * `relicOverrides`, loadouts already optimized for them; Relics in those
 * loadouts are not candidates.
 */
export interface OptimizeRequest extends TeamRequest {
  readonly slot: number;
  readonly constraints?: StatConstraints;
  /** Allow Relics equipped by Characters outside this team. */
  readonly includeEquippedElsewhere?: boolean;
}

export interface OptimizedLoadout {
  readonly relicKeys: Readonly<Record<string, string>>;
  readonly damage: number;
  readonly speed: number;
  readonly plan: SetPlan;
}

export interface OptimizeResponse {
  readonly currentDamage: number;
  readonly loadouts: readonly OptimizedLoadout[];
  readonly evaluations: number;
  readonly simulations: number;
  readonly candidatePieces: number;
}

export function optimizeJob(
  catalog: CombatCatalog,
  request: OptimizeRequest
): OptimizeResponse {
  const prepared = prepareTeam(catalog, request);
  const index = memberIndex(prepared, request.slot);
  const objective = new TeamObjective(
    prepared.input,
    index,
    catalog.data,
    catalog.kits,
    {
      critMode: request.critMode,
    }
  );
  const account = request.sources.account;
  const teamKeys = new Set(
    prepared.resolved
      .filter((member) => member.slot !== request.slot && member.owned)
      .flatMap(
        (member) =>
          account?.characters
            .filter(
              (character) => character.definitionId === member.input.characterId
            )
            .flatMap((character) => character.relicKeys) ?? []
      )
  );
  // Relics an already optimized teammate wears (its override) are taken.
  for (const [slot, keys] of Object.entries(request.relicOverrides ?? {}))
    if (Number(slot) !== request.slot)
      for (const key of Object.values(keys)) teamKeys.add(key);
  const pieces: RelicPiece[] = (account?.relics ?? [])
    .filter((relic) => relic.rarity === 5 && relic.level >= 12)
    .filter((relic) => !teamKeys.has(relic.key))
    .filter(
      (relic) =>
        request.includeEquippedElsewhere !== false ||
        !relic.equippedCharacterKey
    )
    .map((relic) => relicPiece(relic, catalog.properties));
  const currentDamage = objective.evaluate(
    prepared.input.members[index]?.relics ?? { stats: {}, sets: {} }
  );
  const result = searchRelics(objective, catalog.tables, {
    pieces,
    constraints: request.constraints,
  });
  return {
    currentDamage,
    loadouts: result.loadouts.map((entry) => ({
      relicKeys: Object.fromEntries(
        Object.entries(entry.pieces).map(([slot, piece]) => [
          slot,
          piece?.key ?? "",
        ])
      ),
      damage: entry.damage,
      speed: objective.memberPanel(entry.loadout).speed,
      plan: entry.plan,
    })),
    evaluations: result.evaluations,
    simulations: result.simulations,
    candidatePieces: pieces.length,
  };
}

export interface IdealRequest extends TeamRequest {
  readonly slot: number;
  readonly constraints?: StatConstraints;
  /**
   * Allowed main stats per variable slot, replacing the builds' choice for
   * that slot only; an empty list allows every main stat.
   */
  readonly mainStats?: MainStatChoices;
}

export interface IdealResponse {
  readonly damage: number;
  readonly currentDamage: number;
  readonly mainStats: Readonly<Record<string, string>>;
  readonly rolls: Readonly<Record<string, number>>;
  readonly weights: Readonly<Record<string, number>>;
  readonly speed: number;
  /** The member's battle-start panel with the ideal Relics. */
  readonly panel: MemberPanelSummary;
  readonly plan: SetPlan;
  readonly feasible: boolean;
}

export function idealJob(
  catalog: CombatCatalog,
  request: IdealRequest
): IdealResponse {
  const prepared = prepareTeam(catalog, request);
  const index = memberIndex(prepared, request.slot);
  const member = prepared.resolved[index];
  if (!member) throw new Error(`No team member in slot ${request.slot}`);
  const objective = new TeamObjective(
    prepared.input,
    index,
    catalog.data,
    catalog.kits,
    {
      critMode: request.critMode,
    }
  );
  const currentDamage = objective.evaluate(
    prepared.input.members[index]?.relics ?? { stats: {}, sets: {} }
  );
  const ideal = generateIdealRelics(objective, catalog.tables, {
    plan: member.setPlan,
    budget: request.budget ?? "realistic",
    mainStats: { ...member.mainStats, ...request.mainStats },
    constraints: request.constraints,
  });
  const idealPanel = objective.memberPanel(ideal.loadout);
  const assembled = assembleTeam(
    objective.withLoadout(ideal.loadout),
    catalog.data,
    catalog.kits
  ).members[index];
  if (!assembled) throw new Error(`No assembled member in slot ${index}`);
  return {
    damage: ideal.damage,
    currentDamage,
    mainStats: ideal.mainStats,
    rolls: ideal.rolls,
    weights: deriveStatWeights(objective, catalog.tables, ideal.loadout),
    speed: idealPanel.speed,
    panel: panelSummary(assembled.unit),
    plan: member.setPlan,
    feasible: ideal.feasible,
  };
}

export interface CompareRequest extends TeamRequest {
  readonly slot: number;
  readonly kind: "lightCones" | "setPlans";
  /** Minimum SPD / Energy Regeneration Rate each candidate's Relics keep. */
  readonly constraints?: StatConstraints;
}

export interface CompareEntry {
  readonly lightCone?: { id: string; superimposition: number };
  readonly plan?: SetPlan;
  readonly damage: number;
  readonly relative: number;
  /** The candidate's ideal Relics: main stats and substat rolls. */
  readonly ideal?: {
    readonly mainStats: Readonly<Record<string, string>>;
    readonly rolls: Readonly<Record<string, number>>;
  };
}

function idealSummary(ideal: {
  readonly mainStats: Readonly<Record<string, string>>;
  readonly rolls: Readonly<Record<string, number>>;
}): NonNullable<CompareEntry["ideal"]> {
  return { mainStats: { ...ideal.mainStats }, rolls: { ...ideal.rolls } };
}

export function compareJob(
  catalog: CombatCatalog,
  request: CompareRequest
): CompareEntry[] {
  const prepared = prepareTeam(catalog, request);
  const index = memberIndex(prepared, request.slot);
  const member = prepared.resolved[index];
  if (!member) throw new Error(`No team member in slot ${request.slot}`);
  const context = {
    data: catalog.data,
    kits: catalog.kits,
    tables: catalog.tables,
  };
  const relics = {
    plan: member.setPlan,
    budget: request.budget ?? "realistic",
    mainStats: member.mainStats,
    constraints: request.constraints,
    finalists: 1,
  } as const;
  if (request.kind === "lightCones") {
    const character = catalog.data.characters.get(member.input.characterId);
    const candidates = [...catalog.data.lightCones.values()]
      .filter((lightCone) => lightCone.path_id === character?.path_id)
      .map((lightCone) => ({
        id: lightCone.id,
        superimposition: lightCone.rarity >= 5 ? 1 : 5,
      }));
    return compareLightCones(
      prepared.input,
      index,
      candidates,
      context,
      relics
    ).map((entry) => ({
      lightCone: entry.candidate,
      damage: entry.damage,
      relative: entry.relative,
      ideal: idealSummary(entry.ideal),
    }));
  }
  const plans = candidatePlans(
    catalog,
    prepared.input,
    index,
    member,
    request.constraints
  );
  return compareSetPlans(prepared.input, index, plans, context, {
    budget: relics.budget,
    mainStats: relics.mainStats,
    constraints: relics.constraints,
    finalists: 1,
  }).map((entry) => ({
    plan: entry.candidate,
    damage: entry.damage,
    relative: entry.relative,
    ideal: idealSummary(entry.ideal),
  }));
}

/**
 * Cavern and Planar sets screened separately (each against the member's
 * current other half), then the best halves are combined.
 */
function candidatePlans(
  catalog: CombatCatalog,
  input: TeamInput,
  index: number,
  member: ResolvedMember,
  constraints: StatConstraints | undefined
): SetPlan[] {
  const objective = new TeamObjective(input, index, catalog.data, catalog.kits);
  const sets = [...catalog.data.relicSets.values()];
  const score = (plan: SetPlan) => {
    const ideal = generateIdealRelics(objective, catalog.tables, {
      plan,
      mainStats: member.mainStats,
      constraints,
      finalists: 1,
    });
    return ideal.damage;
  };
  const cavern = sets
    .filter((set) => set.kind === "cavern_relic")
    .map((set) => ({
      id: set.id,
      damage: score({
        cavern: { fourPiece: set.id },
        planar: member.setPlan.planar,
      }),
    }))
    .sort((left, right) => right.damage - left.damage)
    .slice(0, 4);
  const planar = sets
    .filter((set) => set.kind === "planar_ornament")
    .map((set) => ({
      id: set.id,
      damage: score({ cavern: member.setPlan.cavern, planar: set.id }),
    }))
    .sort((left, right) => right.damage - left.damage)
    .slice(0, 3);
  return cavern.flatMap((cavernSet) =>
    planar.map((planarSet) => ({
      cavern: { fourPiece: cavernSet.id },
      planar: planarSet.id,
    }))
  );
}

export interface InvestmentRequest extends TeamRequest {
  readonly slot: number;
  /** Highest Eidolon and Superimposition to consider (default E6 / S5). */
  readonly limits?: {
    readonly maxEidolon?: number;
    readonly maxSuperimposition?: number;
  };
}

export interface InvestmentResponse {
  readonly start: number;
  readonly steps: readonly InvestmentStep[];
}

export function investmentJob(
  catalog: CombatCatalog,
  request: InvestmentRequest
): InvestmentResponse {
  const prepared = prepareTeam(catalog, request);
  const index = memberIndex(prepared, request.slot);
  return investmentPath(
    prepared.input,
    index,
    {
      data: catalog.data,
      kits: catalog.kits,
      tables: catalog.tables,
      objective: { critMode: request.critMode },
    },
    request.limits ?? {}
  );
}
