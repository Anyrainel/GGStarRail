import type { AccountSnapshot } from "@/domain/account/schemas";
import type { BuildConfiguration } from "@/domain/build/schemas";
import { canonicalCharacterId } from "@/domain/characterIdentity";
import type { ConfigurableSlot } from "@/domain/combat/optimize/idealRelics";
import type { SetPlan } from "@/domain/combat/optimize/relics";
import {
  EMPTY_LOADOUT,
  type MemberInput,
  type RelicLoadout,
  SCENARIO_PRESETS,
  type ScenarioInput,
} from "@/domain/combat/team/input";
import type { TeamMemberPlan, TeamPlan } from "@/stores/teamSchemas";
import {
  accountMember,
  ownedCharacter,
  type PropertyKinds,
} from "./accountTeam";

/** Build recommendations: the user's workspace first, then in-game presets. */
export interface BuildSources {
  readonly account: AccountSnapshot | null;
  readonly characterLightConeIds: Readonly<Record<string, readonly string[]>>;
  readonly builds: readonly BuildConfiguration[];
  readonly presetLightConeIds: Readonly<Record<string, readonly string[]>>;
  readonly presetBuilds: readonly BuildConfiguration[];
}

export type ValueOrigin =
  | "override"
  | "account"
  | "workspace"
  | "recommended"
  | "default";

export interface ResolvedMember {
  readonly slot: number;
  readonly plan: TeamMemberPlan;
  readonly owned: boolean;
  readonly input: MemberInput;
  readonly lightConeOrigin: ValueOrigin;
  readonly relicSource: "equipped" | "ideal";
  readonly setPlan: SetPlan;
  readonly setPlanOrigin: ValueOrigin;
  /** Main stats the ideal Relics may use (from the chosen builds). */
  readonly mainStats: Partial<Record<ConfigurableSlot, readonly string[]>>;
}

export interface ResolvedTeam {
  readonly members: readonly ResolvedMember[];
  readonly scenario: ScenarioInput;
}

function buildsFor(
  builds: readonly BuildConfiguration[],
  characterId: string
): BuildConfiguration[] {
  const canonical = canonicalCharacterId(characterId);
  return builds.filter(
    (build) => canonicalCharacterId(build.characterDefinitionId) === canonical
  );
}

function setPlanFrom(builds: readonly BuildConfiguration[]): {
  plan: SetPlan;
  mainStats: Partial<Record<ConfigurableSlot, readonly string[]>>;
} | null {
  const cavern = builds.find((build) => build.category === "cavern");
  const planar = builds.find((build) => build.category === "planar");
  if (!cavern && !planar) return null;
  const mainStats: Partial<Record<ConfigurableSlot, readonly string[]>> = {};
  if (cavern?.category === "cavern") {
    mainStats.body = cavern.preferredMainStats.body;
    mainStats.feet = cavern.preferredMainStats.feet;
  }
  if (planar?.category === "planar") {
    mainStats.planarSphere = planar.preferredMainStats.planarSphere;
    mainStats.linkRope = planar.preferredMainStats.linkRope;
  }
  return {
    plan: {
      cavern:
        cavern?.category === "cavern"
          ? cavern.cavern.mode === "four-piece"
            ? { fourPiece: cavern.cavern.setId }
            : { twoPlusTwo: cavern.cavern.setIds }
          : null,
      planar: planar?.category === "planar" ? planar.planarSetId : null,
    },
    mainStats,
  };
}

function overridePlan(plan: NonNullable<TeamMemberPlan["setPlan"]>): SetPlan {
  const [first, second] = plan.cavern;
  return {
    cavern: first
      ? second
        ? { twoPlusTwo: [first, second] }
        : { fourPiece: first }
      : null,
    planar: plan.planar,
  };
}

/**
 * Turn a saved team into simulation input. Values the user did not choose
 * come from the account (level, Eidolon, Traces, equipped gear), then the
 * user's Character builds, then in-game recommendations.
 */
export function resolveTeam(
  team: TeamPlan,
  sources: BuildSources,
  properties: PropertyKinds
): ResolvedTeam {
  const members: ResolvedMember[] = [];
  team.members.forEach((plan, slot) => {
    if (!plan) return;
    const owned = ownedCharacter(sources.account, plan.characterId);
    const base: MemberInput =
      owned && sources.account
        ? accountMember(sources.account, owned, properties)
        : {
            characterId: plan.characterId,
            level: 80,
            eidolon: 0,
            traces: {},
            lightCone: null,
            relics: EMPTY_LOADOUT,
          };
    const canonical = canonicalCharacterId(plan.characterId);

    let lightCone = base.lightCone;
    let lightConeOrigin: ValueOrigin = lightCone ? "account" : "default";
    if (plan.lightCone !== undefined) {
      lightCone = plan.lightCone
        ? {
            id: plan.lightCone.id,
            level: 80,
            superimposition: plan.lightCone.superimposition,
          }
        : null;
      lightConeOrigin = "override";
    } else if (!lightCone) {
      const preferred = sources.characterLightConeIds[canonical]?.[0];
      const recommended = sources.presetLightConeIds[canonical]?.[0];
      if (preferred) {
        lightCone = { id: preferred, level: 80, superimposition: 1 };
        lightConeOrigin = "workspace";
      } else if (recommended) {
        lightCone = { id: recommended, level: 80, superimposition: 1 };
        lightConeOrigin = "recommended";
      }
    }

    const hasEquippedRelics = Object.keys(base.relics.sets).length > 0;
    const relicSource =
      plan.relics ?? (owned && hasEquippedRelics ? "equipped" : "ideal");

    const workspace = setPlanFrom(buildsFor(sources.builds, plan.characterId));
    const recommended = setPlanFrom(
      buildsFor(sources.presetBuilds, plan.characterId)
    );
    let setPlan: SetPlan = { cavern: null, planar: null };
    let setPlanOrigin: ValueOrigin = "default";
    let mainStats: ResolvedMember["mainStats"] = {};
    if (plan.setPlan) {
      setPlan = overridePlan(plan.setPlan);
      setPlanOrigin = "override";
      mainStats = workspace?.mainStats ?? recommended?.mainStats ?? {};
    } else if (workspace) {
      setPlan = workspace.plan;
      setPlanOrigin = "workspace";
      mainStats = workspace.mainStats;
    } else if (recommended) {
      setPlan = recommended.plan;
      setPlanOrigin = "recommended";
      mainStats = recommended.mainStats;
    }

    const relics: RelicLoadout =
      relicSource === "equipped" ? base.relics : EMPTY_LOADOUT;
    members.push({
      slot,
      plan,
      owned: owned !== undefined,
      input: {
        ...base,
        characterId: plan.characterId,
        level: plan.level ?? base.level,
        ascension: plan.level !== undefined ? undefined : base.ascension,
        eidolon: plan.eidolon ?? base.eidolon,
        lightCone,
        relics,
        options: plan.options,
        play: { skill: plan.skill },
      },
      lightConeOrigin,
      relicSource,
      setPlan,
      setPlanOrigin,
      mainStats,
    });
  });
  const preset = SCENARIO_PRESETS[team.scenario];
  return {
    members,
    scenario: { ...preset, cycles: team.cycles, enemyLevel: team.enemyLevel },
  };
}
