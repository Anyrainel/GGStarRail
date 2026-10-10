import { canonicalCharacterId } from "@/domain/characterIdentity";
import type { LightConeData, RelicSetData } from "../model/data";
import {
  type CompiledKit,
  KitBuilder,
  type OptionValues,
  type TeamMemberInfo,
} from "./builder";

/** Facts about the wearer an equipment effect may depend on. */
export interface WearerInfo {
  readonly characterId: string;
  readonly pathId: string;
  readonly combatType: string;
  readonly maxEnergy: number;
}

/**
 * Light Cone translations only cover conditional effects. Base stats and
 * the effect's unconditional `properties` are applied from the catalog.
 */
export class LightConeKitBuilder extends KitBuilder {
  readonly superimposition: number;

  constructor(
    readonly data: LightConeData,
    superimposition: number,
    readonly wearer: WearerInfo,
    options: OptionValues = {},
    team: readonly TeamMemberInfo[] = []
  ) {
    super(options, team);
    this.superimposition = Math.min(
      Math.max(superimposition, 1),
      data.effect.superimpositions.length
    );
  }

  protected override ownCharacterId(): string {
    return canonicalCharacterId(this.wearer.characterId);
  }

  /** `#index` of the effect at the current Superimposition. */
  s(index: number): number {
    const row = this.data.effect.superimpositions[this.superimposition - 1];
    const value = row?.parameters[index - 1];
    if (value === undefined) {
      throw new Error(`Light Cone ${this.data.id} has no #${index}`);
    }
    return value;
  }

  compile(): CompiledKit {
    return this.compileShared();
  }
}

export interface LightConeKitDefinition {
  readonly type: "lightCone";
  readonly id: string;
  build(k: LightConeKitBuilder): void;
}

export function defineLightCone(
  id: string,
  build: (k: LightConeKitBuilder) => void
): LightConeKitDefinition {
  return { type: "lightCone", id, build };
}

/**
 * Relic set translations cover conditional effects of one bonus tier. The
 * tier's unconditional `properties` are applied from the catalog.
 */
export class RelicSetKitBuilder extends KitBuilder {
  constructor(
    readonly data: RelicSetData,
    readonly pieces: 2 | 4,
    readonly wearer: WearerInfo,
    options: OptionValues = {},
    team: readonly TeamMemberInfo[] = []
  ) {
    super(options, team);
  }

  protected override ownCharacterId(): string {
    return canonicalCharacterId(this.wearer.characterId);
  }

  /** `#index` of this tier's bonus text. */
  param(index: number): number {
    const bonus = this.data.bonuses.find(
      (entry) => entry.required_pieces === this.pieces
    );
    const value = bonus?.parameters[index - 1];
    if (value === undefined) {
      throw new Error(
        `Relic set ${this.data.id} ${this.pieces}-piece has no #${index}`
      );
    }
    return value;
  }

  compile(): CompiledKit {
    return this.compileShared();
  }
}

export interface RelicSetKitDefinition {
  readonly type: "relicSet";
  readonly id: string;
  readonly twoPiece?: (k: RelicSetKitBuilder) => void;
  readonly fourPiece?: (k: RelicSetKitBuilder) => void;
}

export function defineRelicSet(
  id: string,
  tiers: {
    twoPiece?: (k: RelicSetKitBuilder) => void;
    fourPiece?: (k: RelicSetKitBuilder) => void;
  }
): RelicSetKitDefinition {
  return { type: "relicSet", id, ...tiers };
}
