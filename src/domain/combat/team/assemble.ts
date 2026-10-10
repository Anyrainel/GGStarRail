import { statBonusTraceId } from "@/domain/account/traces";
import { canonicalCharacterId } from "@/domain/characterIdentity";
import { isCombatTypeId } from "@/domain/stats";
import {
  Battle,
  type BattleOptions,
  DEFAULT_BATTLE_OPTIONS,
} from "../battle/battle";
import {
  type AppliedModifier,
  appliedModifier,
  CombatUnit,
  type EffectSource,
  EnemyUnit,
} from "../battle/units";
import type { PermanentModifier, PolicyView, TurnPolicy } from "../kit/api";
import type {
  CompiledCharacterKit,
  CompiledKit,
  OptionDef,
  TeamMemberInfo,
  TeamModifier,
} from "../kit/builder";
import { CharacterKitBuilder } from "../kit/character";
import {
  LightConeKitBuilder,
  RelicSetKitBuilder,
  type WearerInfo,
} from "../kit/equipment";
import type { KitRegistry } from "../kit/registry";
import {
  ascensionForLevel,
  type CharacterData,
  type CombatReferenceData,
  type KitPropertyValue,
  scaledStat,
} from "../model/data";
import {
  type CombatType,
  combineStat,
  newStatVector,
  PROPERTY_STAT,
  type StatVector,
} from "../model/stats";
import type { MemberInput, RelicLoadout, TeamInput } from "./input";

const PATH_AGGRO: Readonly<Record<string, number>> = {
  Warrior: 125,
  Knight: 150,
  Rogue: 75,
  Mage: 75,
  Shaman: 100,
  Warlock: 100,
  Priest: 100,
  Memory: 100,
  Elation: 100,
};

/** Declared options of one entity on one team member, for the UI. */
export interface MemberOptionGroup {
  readonly entity: "character" | "lightCone" | `set:${string}`;
  readonly entityId: string;
  readonly options: readonly OptionDef[];
}

export interface AssembledMember {
  readonly slot: number;
  readonly unit: CombatUnit;
  readonly data: CharacterData;
  /** Panel without Relic substats/main stats (set bonuses included). */
  readonly panelWithoutRelics: StatVector;
  readonly optionGroups: readonly MemberOptionGroup[];
  readonly implemented: {
    character: boolean;
    lightCone: boolean | null;
    relicSets: Readonly<Record<string, boolean>>;
  };
}

export interface AssembledTeam {
  readonly battle: Battle;
  readonly members: readonly AssembledMember[];
  readonly enemies: readonly EnemyUnit[];
  /** Every unit by ID after the battle ran (memosprites included). */
  units(): Map<string, CombatUnit>;
  enemyMap(): Map<string, EnemyUnit>;
}

export function addProperties(
  vector: StatVector,
  properties: readonly KitPropertyValue[],
  scale = 1
): void {
  for (const { property_id, value } of properties) {
    const mapping = PROPERTY_STAT[property_id];
    if (!mapping || mapping.combatType) continue;
    combineStat(vector, mapping.stat, value * scale);
  }
}

/** Elemental DMG Boost properties become Combat Type–filtered modifiers. */
function elementalProperties(
  properties: readonly KitPropertyValue[]
): PermanentModifier[] {
  const result: PermanentModifier[] = [];
  for (const { property_id, value } of properties) {
    const mapping = PROPERTY_STAT[property_id];
    if (!mapping?.combatType) continue;
    result.push({
      stat: mapping.stat,
      value,
      filter: { combatTypes: [mapping.combatType] },
      origin: "traceStats",
    });
  }
  return result;
}

export function relicVector(loadout: RelicLoadout): {
  vector: StatVector;
} {
  const vector = newStatVector();
  const properties = Object.entries(loadout.stats).map(
    ([property_id, value]) => ({
      property_id,
      value,
    })
  );
  addProperties(vector, properties);
  return { vector };
}

/** Relic Elemental DMG Boost by Combat Type (Planar Sphere main stats). */
export function relicElementalBoost(
  loadout: RelicLoadout
): Partial<Record<CombatType, number>> {
  const boost: Partial<Record<CombatType, number>> = {};
  for (const [propertyId, value] of Object.entries(loadout.stats)) {
    const type = PROPERTY_STAT[propertyId]?.combatType;
    if (type) boost[type] = (boost[type] ?? 0) + value;
  }
  return boost;
}

function characterBasePanel(
  data: CharacterData,
  member: MemberInput
): StatVector {
  const vector = newStatVector();
  const ascension =
    member.ascension ?? ascensionForLevel(data.stat_scaling, member.level);
  const level = member.level;
  combineStat(
    vector,
    "hpBase",
    scaledStat(data.stat_scaling, "hp", level, ascension)
  );
  combineStat(
    vector,
    "atkBase",
    scaledStat(data.stat_scaling, "attack", level, ascension)
  );
  combineStat(
    vector,
    "defBase",
    scaledStat(data.stat_scaling, "defence", level, ascension)
  );
  combineStat(
    vector,
    "spdBase",
    scaledStat(data.stat_scaling, "speed", level, ascension)
  );
  combineStat(
    vector,
    "critRate",
    scaledStat(data.stat_scaling, "critical_chance", level, ascension)
  );
  combineStat(
    vector,
    "critDmg",
    scaledStat(data.stat_scaling, "critical_damage", level, ascension)
  );
  return vector;
}

/** Fraction of Stat Bonus nodes unlocked; unknown sources count as all. */
function statBonusFraction(member: MemberInput): number {
  let reported = 0;
  let unlocked = 0;
  for (let index = 1; index <= 10; index += 1) {
    const value = member.traces[statBonusTraceId(member.characterId, index)];
    if (value === undefined) continue;
    reported += 1;
    if (value > 0) unlocked += 1;
  }
  return reported === 0 ? 1 : unlocked / reported;
}

function permanentToUnit(
  unit: CombatUnit,
  modifiers: readonly PermanentModifier[],
  source: EffectSource
): void {
  for (const modifier of modifiers) {
    if (!modifier.filter && !modifier.scaling) {
      combineStat(unit.panel, modifier.stat, modifier.value ?? 0);
    } else {
      unit.conditional.push(
        appliedModifier(modifier, modifier.origin, source, source.providerId, 1)
      );
    }
  }
}

interface PreparedKit {
  kit: CompiledKit;
  source: EffectSource;
}

/**
 * Builds Characters, equipment effects, and enemies for a team. A missing
 * kit leaves the entity's data-driven stats in place and reports it as not
 * implemented, so partial coverage is visible rather than silent.
 */
export function assembleTeam(
  input: TeamInput,
  data: CombatReferenceData,
  kits: KitRegistry,
  battleOptions: Partial<BattleOptions> = {}
): AssembledTeam {
  const members: AssembledMember[] = [];
  const relicVectors: StatVector[] = [];
  const team: TeamMemberInfo[] = input.members.flatMap((member, slot) => {
    const definition = data.characters.get(member.characterId);
    return definition
      ? [
          {
            characterId: canonicalCharacterId(definition.id),
            pathId: definition.path_id,
            combatType: definition.combat_type_id,
            slot,
          },
        ]
      : [];
  });
  const characterKits: (CompiledCharacterKit | null)[] = [];
  const equipmentKits: PreparedKit[][] = [];
  const characterSources: EffectSource[] = [];

  input.members.forEach((member, slot) => {
    const characterData = data.characters.get(member.characterId);
    if (!characterData) {
      throw new Error(`Unknown Character ${member.characterId}`);
    }
    if (!isCombatTypeId(characterData.combat_type_id)) {
      throw new Error(`Unknown Combat Type ${characterData.combat_type_id}`);
    }
    const unitId = `ally:${slot}`;
    const panel = characterBasePanel(characterData, member);
    const unit = new CombatUnit(
      unitId,
      "character",
      characterData.id,
      characterData.combat_type_id,
      member.level,
      panel,
      null,
      slot,
      characterData.path_id
    );
    unit.maxEnergy = characterData.max_energy;
    unit.aggro =
      characterData.stat_scaling[0]?.stats.base_aggro?.base_value ??
      PATH_AGGRO[characterData.path_id] ??
      100;
    const characterSource: EffectSource = {
      type: "character",
      id: characterData.id,
      providerId: unitId,
    };
    characterSources.push(characterSource);

    addProperties(panel, characterData.trace_stats, statBonusFraction(member));
    permanentToUnit(
      unit,
      elementalProperties(characterData.trace_stats),
      characterSource
    );

    const wearer: WearerInfo = {
      characterId: characterData.id,
      pathId: characterData.path_id,
      combatType: characterData.combat_type_id,
      maxEnergy: characterData.max_energy,
    };
    const prepared: PreparedKit[] = [];
    const optionGroups: MemberOptionGroup[] = [];
    let lightConeImplemented: boolean | null = null;

    if (member.lightCone) {
      const lightCone = data.lightCones.get(member.lightCone.id);
      if (!lightCone)
        throw new Error(`Unknown Light Cone ${member.lightCone.id}`);
      const lcAscension =
        member.lightCone.ascension ??
        ascensionForLevel(lightCone.stat_scaling, member.lightCone.level);
      const lcLevel = member.lightCone.level;
      combineStat(
        panel,
        "hpBase",
        scaledStat(lightCone.stat_scaling, "hp", lcLevel, lcAscension)
      );
      combineStat(
        panel,
        "atkBase",
        scaledStat(lightCone.stat_scaling, "attack", lcLevel, lcAscension)
      );
      combineStat(
        panel,
        "defBase",
        scaledStat(lightCone.stat_scaling, "defence", lcLevel, lcAscension)
      );
      if (lightCone.path_id === characterData.path_id) {
        const superimposition = Math.min(
          Math.max(member.lightCone.superimposition, 1),
          lightCone.effect.superimpositions.length
        );
        const row = lightCone.effect.superimpositions[superimposition - 1];
        const source: EffectSource = {
          type: "lightCone",
          id: lightCone.id,
          providerId: unitId,
        };
        if (row) {
          addProperties(panel, row.properties);
          permanentToUnit(unit, elementalProperties(row.properties), source);
        }
        const definition = kits.lightCone(lightCone.id);
        lightConeImplemented = definition !== undefined;
        if (definition) {
          const builder = new LightConeKitBuilder(
            lightCone,
            superimposition,
            wearer,
            member.options?.lightCone,
            team
          );
          definition.build(builder);
          const kit = builder.compile();
          prepared.push({ kit, source });
          optionGroups.push({
            entity: "lightCone",
            entityId: lightCone.id,
            options: kit.options,
          });
        }
      }
    }

    const relicSetsImplemented: Record<string, boolean> = {};
    for (const [setId, pieces] of Object.entries(member.relics.sets)) {
      const set = data.relicSets.get(setId);
      if (!set || pieces < 2) continue;
      const source: EffectSource = {
        type: "relicSet",
        id: setId,
        providerId: unitId,
      };
      const definition = kits.relicSet(setId);
      relicSetsImplemented[setId] = definition !== undefined;
      for (const tier of [2, 4] as const) {
        if (pieces < tier) continue;
        const bonus = set.bonuses.find(
          (entry) => entry.required_pieces === tier
        );
        if (!bonus) continue;
        addProperties(panel, bonus.properties);
        permanentToUnit(unit, elementalProperties(bonus.properties), source);
        const build = tier === 2 ? definition?.twoPiece : definition?.fourPiece;
        if (!build) continue;
        const builder = new RelicSetKitBuilder(
          set,
          tier,
          wearer,
          member.options?.[`set:${setId}`],
          team
        );
        build(builder);
        const kit = builder.compile();
        prepared.push({ kit, source });
        if (kit.options.length > 0) {
          optionGroups.push({
            entity: `set:${setId}`,
            entityId: setId,
            options: kit.options,
          });
        }
      }
    }

    const relics = relicVector(member.relics);
    relicVectors.push(relics.vector);
    for (let index = 0; index < panel.length; index += 1) {
      panel[index] = (panel[index] ?? 0) + (relics.vector[index] ?? 0);
    }
    unit.relicElemental = relicElementalBoost(member.relics);

    const characterDefinition = kits.character(
      canonicalCharacterId(characterData.id)
    );
    let characterKit: CompiledCharacterKit | null = null;
    if (characterDefinition) {
      const builder = new CharacterKitBuilder(
        characterData,
        { eidolon: member.eidolon, traces: member.traces },
        member.options?.character,
        team
      );
      characterDefinition.build(builder);
      characterKit = builder.compile();
      optionGroups.unshift({
        entity: "character",
        entityId: characterData.id,
        options: characterKit.options,
      });
    }
    characterKits.push(characterKit);
    equipmentKits.push(prepared);

    members.push({
      slot,
      unit,
      data: characterData,
      // Filled in once every permanent modifier is on the panel.
      panelWithoutRelics: newStatVector(),
      optionGroups,
      implemented: {
        character: characterKit !== null,
        lightCone: lightConeImplemented,
        relicSets: relicSetsImplemented,
      },
    });
  });

  // Permanent self modifiers and kit behaviour.
  members.forEach((member, slot) => {
    const kit = characterKits[slot];
    const source = characterSources[slot];
    if (!source) return;
    if (kit) {
      permanentToUnit(member.unit, kit.permanent, source);
      member.unit.behaviour = {
        abilities: kit.abilities,
        turnPolicy: playPolicy(kit.turnPolicy, input.members[slot]?.play),
        ultimatePolicy: kit.ultimatePolicy,
      };
      member.unit.energy = member.unit.maxEnergy * kit.startingEnergy;
    } else {
      member.unit.energy = member.unit.maxEnergy * 0.5;
    }
    for (const prepared of equipmentKits[slot] ?? []) {
      permanentToUnit(member.unit, prepared.kit.permanent, prepared.source);
    }
  });

  const combatTypes = new Set<CombatType>(
    members.map((member) => member.unit.combatType)
  );
  const scenario = input.scenario;
  const weaknesses =
    scenario.weaknesses === "team"
      ? [...combatTypes]
      : [...scenario.weaknesses];
  const enemies: EnemyUnit[] = [];
  for (let index = 0; index < Math.max(1, scenario.enemyCount); index += 1) {
    enemies.push(
      new EnemyUnit(`enemy:${index}`, {
        level: scenario.enemyLevel,
        speed: scenario.enemySpeed,
        maxToughness: scenario.toughness,
        weaknesses,
        resistance: scenario.resistance,
        weakResistance: scenario.weakResistance,
        effectResistance: scenario.effectResistance,
        panel: newStatVector(),
      })
    );
  }

  const battle = new Battle(
    members.map((member) => member.unit),
    enemies,
    {
      ...DEFAULT_BATTLE_OPTIONS,
      cycles: scenario.cycles,
      enemyAttackEnergy: scenario.enemyAttackEnergy,
      ...battleOptions,
    }
  );

  // Team auras, listeners, statuses, memosprites, and summons.
  const teamModifiers: { modifier: TeamModifier; source: EffectSource }[] = [];
  // Aura entries on each unit, so memosprites copying their owner's
  // permanent modifiers do not receive the auras a second time.
  const teamAuraEntries = new Set<AppliedModifier>();
  members.forEach((member, slot) => {
    const kit = characterKits[slot];
    const characterSource = characterSources[slot];
    const all: PreparedKit[] = [
      ...(kit && characterSource ? [{ kit, source: characterSource }] : []),
      ...(equipmentKits[slot] ?? []),
    ];
    for (const { kit: compiled, source } of all) {
      for (const status of compiled.statuses)
        battle.statusSources.set(status, source);
      for (const listener of compiled.listeners) {
        battle.addListener(member.unit, listener, source);
      }
      for (const modifier of compiled.team)
        teamModifiers.push({ modifier, source });
    }
    if (kit && characterSource) {
      registerServants(
        battle,
        member.unit,
        kit,
        characterSource,
        teamAuraEntries
      );
    }
  });
  // Equipment auras of the same Light Cone or set from several wearers do
  // not stack ("effects of the same type cannot stack"): keep the strongest.
  const strongest = new Map<
    string,
    { modifier: TeamModifier; source: EffectSource }
  >();
  for (const entry of teamModifiers) {
    if (entry.source.type === "character") continue;
    const key = `${entry.source.type}:${entry.source.id}:${entry.modifier.stat}:${JSON.stringify(entry.modifier.filter ?? {})}`;
    const current = strongest.get(key);
    if (
      !current ||
      (entry.modifier.value ?? 0) > (current.modifier.value ?? 0)
    ) {
      strongest.set(key, entry);
    }
  }
  const keptTeamModifiers = teamModifiers.filter(
    (entry) =>
      entry.source.type === "character" ||
      [...strongest.values()].includes(entry)
  );
  const applyTeamModifiers = (unit: CombatUnit) => {
    for (const { modifier, source } of keptTeamModifiers) {
      if (modifier.scope === "otherAllies" && unit.id === source.providerId)
        continue;
      if (
        modifier.combatTypes &&
        !modifier.combatTypes.includes(unit.combatType)
      )
        continue;
      if (modifier.paths && !modifier.paths.includes(unit.pathId)) continue;
      const entry = appliedModifier(
        modifier,
        modifier.origin,
        source,
        source.providerId,
        1
      );
      teamAuraEntries.add(entry);
      unit.conditional.push(entry);
    }
  };
  for (const member of members) applyTeamModifiers(member.unit);
  battle.onUnitCreated = applyTeamModifiers;
  if (characterKits.some((kit) => kit?.abilities.has("elationSkill"))) {
    const aha = new CombatUnit(
      "aha",
      "summon",
      "aha",
      "Physical",
      80,
      newStatVector(),
      null,
      -1,
      "Elation"
    );
    aha.speedFunction = () => battle.ahaSpeed();
    aha.inActionOrder = false;
    battle.aha = aha;
    battle.summons.push(aha);
  }
  for (const member of members) {
    const kit = characterKits[member.slot];
    for (const memosprite of kit?.memosprites ?? []) {
      if (memosprite.presentAtStart)
        battle.summon(member.unit, memosprite.servantId);
    }
    for (const summon of kit?.summons ?? []) {
      if (summon.presentAtStart) battle.summon(member.unit, summon.id);
    }
  }

  // The optimizer swaps Relics on top of everything else that is permanent.
  members.forEach((member, slot) => {
    const relics = relicVectors[slot];
    member.unit.panel.forEach((value, index) => {
      member.panelWithoutRelics[index] = value - (relics?.[index] ?? 0);
    });
  });

  return {
    battle,
    members,
    enemies,
    units: () =>
      new Map(
        [...battle.allies, ...battle.summons, ...battle.retired].map((unit) => [
          unit.id,
          unit,
        ])
      ),
    enemyMap: () => new Map(enemies.map((enemy) => [enemy.id, enemy])),
  };
}

function playPolicy(
  kitPolicy: TurnPolicy,
  overrides: MemberInput["play"]
): TurnPolicy {
  if (!overrides?.skill || overrides.skill === "kit") return kitPolicy;
  const swap = (from: string, to: string) => (view: PolicyView) => {
    const choice = kitPolicy(view);
    const ability = typeof choice === "string" ? choice : choice.ability;
    if (ability !== from) return choice;
    if (to === "skill" && view.skillPoints < 1) return choice;
    // A designated ally belongs to the replaced ability, not the new one.
    return to;
  };
  return overrides.skill === "avoid"
    ? swap("skill", "basic")
    : swap("basic", "skill");
}

function registerServants(
  battle: Battle,
  owner: CombatUnit,
  kit: CompiledCharacterKit,
  source: EffectSource,
  teamAuraEntries: ReadonlySet<AppliedModifier>
): void {
  for (const memosprite of kit.memosprites) {
    battle.servantFactories.set(
      `${owner.id}:${memosprite.servantId}`,
      (unitOwner) => {
        const unit = new CombatUnit(
          `${unitOwner.id}:memo:${memosprite.servantId}`,
          "memosprite",
          memosprite.servantId,
          unitOwner.combatType,
          unitOwner.level,
          // Memosprites share their owner's panel (HP and SPD aside), so
          // equipment changes on the owner reach them without re-assembly.
          unitOwner.panel,
          unitOwner,
          unitOwner.slot,
          unitOwner.pathId
        );
        unit.speedRule = {
          ownerRatio: memosprite.speed.ownerRatio ?? 0,
          flat: memosprite.speed.flat ?? 0,
        };
        // The owner's own permanent modifiers; team auras are applied to
        // the memosprite when it is created.
        unit.conditional.push(
          ...unitOwner.conditional.filter(
            (entry) => !teamAuraEntries.has(entry)
          )
        );
        unit.behaviour = {
          abilities: new Map(
            memosprite.abilities.map((ability) => [ability.id, ability])
          ),
          turnPolicy:
            memosprite.policy ?? (() => memosprite.abilities[0]?.id ?? "basic"),
          ultimatePolicy: null,
        };
        battle.sources.set(unit, source);
        return unit;
      }
    );
  }
  for (const summon of kit.summons) {
    battle.servantFactories.set(`${owner.id}:${summon.id}`, (unitOwner) => {
      const unit = new CombatUnit(
        `${unitOwner.id}:summon:${summon.id}`,
        "summon",
        summon.id,
        unitOwner.combatType,
        unitOwner.level,
        newStatVector(),
        unitOwner,
        unitOwner.slot,
        unitOwner.pathId
      );
      unit.fixedSpeed = summon.speed;
      unit.behaviour = {
        abilities: new Map(
          summon.abilities.map((ability) => [ability.id, ability])
        ),
        turnPolicy: summon.policy,
        ultimatePolicy: null,
      };
      battle.sources.set(unit, source);
      return unit;
    });
  }
}
