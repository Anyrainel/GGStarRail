import type { BuildConfiguration } from "@/domain/build/schemas";
import type { SetPlan } from "@/domain/combat/optimize/relics";
import type { AccountSnapshot, Relic } from "@/domain/game-account/schemas";
import type { TeamPlan } from "@/domain/team/schemas";
import { ownedCharacter } from "./accountTeam";
import type { WorkspaceSources } from "./jobs";
import {
  type ResolvedMember,
  resolveLightCone,
  resolveRelicSource,
  resolveSetPlan,
  type ValueOrigin,
} from "./resolve";

/** In-game recommendations, the last fallback for unchosen gear. */
export interface CombatPresets {
  readonly presetBuilds: readonly BuildConfiguration[];
  readonly presetLightConeIds: Readonly<Record<string, readonly string[]>>;
}

export const NO_COMBAT_PRESETS: CombatPresets = {
  presetBuilds: [],
  presetLightConeIds: {},
};

let presetRequest: Promise<CombatPresets> | null = null;

/** The in-game recommendation presets, loaded once per session. */
export function loadCombatPresets(): Promise<CombatPresets> {
  presetRequest ??= import("@/config/presets/builds/in-game.json").then(
    (module) => {
      const preset = module.default as unknown as {
        builds: BuildConfiguration[];
        characterLightConeIds: Record<string, string[]>;
      };
      return {
        presetBuilds: preset.builds,
        presetLightConeIds: preset.characterLightConeIds,
      };
    }
  );
  return presetRequest;
}

/** Set IDs of a plan: one Cavern set (4-piece) or two (2+2), and a Planar set. */
export interface PlanSets {
  readonly cavern: readonly string[];
  readonly planar: string | null;
}

export function planSets(plan: SetPlan): PlanSets {
  const cavern = plan.cavern;
  return {
    cavern: !cavern
      ? []
      : "fourPiece" in cavern
        ? [cavern.fourPiece]
        : [...cavern.twoPlusTwo],
    planar: plan.planar,
  };
}

/**
 * What a team slot shows before (or without) a simulation. Values follow the
 * same precedence as `resolveTeam`, but no stats are computed.
 */
export interface MemberPreview {
  readonly slot: number;
  readonly characterId: string;
  readonly owned: boolean;
  readonly level: number;
  readonly eidolon: number;
  readonly eidolonOrigin: ValueOrigin;
  /** The account Eidolon, when the Character is owned. */
  readonly accountEidolon: number | null;
  readonly lightCone: {
    readonly id: string;
    readonly superimposition: number;
  } | null;
  readonly lightConeOrigin: ValueOrigin;
  readonly relicSource: "equipped" | "ideal";
  /** Relics the owned Character wears on the account (may be empty). */
  readonly equippedRelics: readonly Relic[];
  /** The ideal-Relic set plan the simulation would use. */
  readonly plannedSets: PlanSets;
  readonly setPlanOrigin: ValueOrigin;
  /** Main stats ideal Relics may use, from the same builds as the plan. */
  readonly mainStats: ResolvedMember["mainStats"];
}

export type TeamPreview = ReadonlyMap<number, MemberPreview>;

function wornRelics(
  account: AccountSnapshot | null,
  relicKeys: readonly string[]
): Relic[] {
  if (!account || !relicKeys.length) return [];
  const keys = new Set(relicKeys);
  return account.relics.filter((relic) => keys.has(relic.key));
}

/** Previews every filled slot of a team. */
export function previewTeam(
  team: TeamPlan,
  sources: WorkspaceSources,
  presets: CombatPresets
): TeamPreview {
  const previews = new Map<number, MemberPreview>();
  const context = { ...sources, ...presets };
  team.members.forEach((plan, slot) => {
    if (!plan) return;
    const owned = ownedCharacter(sources.account, plan.characterId);
    const equippedRelics = owned
      ? wornRelics(sources.account, owned.relicKeys)
      : [];
    const accountLightCone =
      owned?.lightConeKey && sources.account
        ? sources.account.lightCones.find(
            (entry) => entry.key === owned.lightConeKey
          )
        : undefined;
    const { lightCone, origin: lightConeOrigin } = resolveLightCone(
      plan,
      accountLightCone
        ? {
            id: accountLightCone.definitionId,
            level: accountLightCone.level,
            superimposition: accountLightCone.superimposition,
          }
        : null,
      context
    );
    const {
      setPlan,
      origin: setPlanOrigin,
      mainStats,
    } = resolveSetPlan(plan, context);
    const accountEidolon = owned?.eidolon ?? null;
    previews.set(slot, {
      slot,
      characterId: plan.characterId,
      owned: owned !== undefined,
      level: plan.level ?? owned?.level ?? 80,
      eidolon: plan.eidolon ?? accountEidolon ?? 0,
      eidolonOrigin:
        plan.eidolon !== undefined
          ? "override"
          : accountEidolon !== null
            ? "account"
            : "default",
      accountEidolon,
      lightCone: lightCone
        ? { id: lightCone.id, superimposition: lightCone.superimposition }
        : null,
      lightConeOrigin,
      relicSource: resolveRelicSource(
        plan,
        owned !== undefined,
        equippedRelics.length > 0
      ),
      equippedRelics,
      plannedSets: planSets(setPlan),
      setPlanOrigin,
      mainStats,
    });
  });
  return previews;
}
