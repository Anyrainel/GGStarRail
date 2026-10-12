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
import type { TeamMemberPlan, TeamPlan } from "@/domain/team/schemas";
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

export function buildsFor(
  builds: readonly BuildConfiguration[],
  characterId: string
): BuildConfiguration[] {
  const canonical = canonicalCharacterId(characterId);
  return builds.filter(
    (build) => canonicalCharacterId(build.characterDefinitionId) === canonical
  );
}

export function setPlanFrom(builds: readonly BuildConfiguration[]): {
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

export function overridePlan(
  plan: NonNullable<TeamMemberPlan["setPlan"]>
): SetPlan {
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

type LightCone = MemberInput["lightCone"];

/**
 * The member's Light Cone: the override, else the account's equipped one,
 * else the preferred Light Cone in the user's builds, else the in-game
 * recommendation.
 */
export function resolveLightCone(
  plan: TeamMemberPlan,
  equipped: LightCone,
  sources: Pick<BuildSources, "characterLightConeIds" | "presetLightConeIds">
): { lightCone: LightCone; origin: ValueOrigin } {
  if (plan.lightCone !== undefined)
    return {
      lightCone: plan.lightCone
        ? {
            id: plan.lightCone.id,
            level: 80,
            superimposition: plan.lightCone.superimposition,
          }
        : null,
      origin: "override",
    };
  if (equipped) return { lightCone: equipped, origin: "account" };
  const canonical = canonicalCharacterId(plan.characterId);
  const preferred = sources.characterLightConeIds[canonical]?.[0];
  if (preferred)
    return {
      lightCone: { id: preferred, level: 80, superimposition: 1 },
      origin: "workspace",
    };
  const recommended = sources.presetLightConeIds[canonical]?.[0];
  if (recommended)
    return {
      lightCone: { id: recommended, level: 80, superimposition: 1 },
      origin: "recommended",
    };
  return { lightCone: null, origin: "default" };
}

/**
 * The ideal-Relic set plan: the override, else the user's Character builds,
 * else the in-game recommendation. Main stats come from the same builds.
 */
export function resolveSetPlan(
  plan: TeamMemberPlan,
  sources: Pick<BuildSources, "builds" | "presetBuilds">
): {
  setPlan: SetPlan;
  origin: ValueOrigin;
  mainStats: ResolvedMember["mainStats"];
} {
  const workspace = setPlanFrom(buildsFor(sources.builds, plan.characterId));
  const recommended = setPlanFrom(
    buildsFor(sources.presetBuilds, plan.characterId)
  );
  if (plan.setPlan)
    return {
      setPlan: overridePlan(plan.setPlan),
      origin: "override",
      mainStats: workspace?.mainStats ?? recommended?.mainStats ?? {},
    };
  if (workspace)
    return {
      setPlan: workspace.plan,
      origin: "workspace",
      mainStats: workspace.mainStats,
    };
  if (recommended)
    return {
      setPlan: recommended.plan,
      origin: "recommended",
      mainStats: recommended.mainStats,
    };
  return {
    setPlan: { cavern: null, planar: null },
    origin: "default",
    mainStats: {},
  };
}

/** Equipped Relics when the Character is owned and wears any, else ideal. */
export function resolveRelicSource(
  plan: TeamMemberPlan,
  owned: boolean,
  wearsRelics: boolean
): "equipped" | "ideal" {
  return plan.relics ?? (owned && wearsRelics ? "equipped" : "ideal");
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
    const { lightCone, origin: lightConeOrigin } = resolveLightCone(
      plan,
      base.lightCone,
      sources
    );
    const relicSource = resolveRelicSource(
      plan,
      owned !== undefined,
      Object.keys(base.relics.sets).length > 0
    );
    const {
      setPlan,
      origin: setPlanOrigin,
      mainStats,
    } = resolveSetPlan(plan, sources);

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
