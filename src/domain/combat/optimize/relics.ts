import type { RelicSlot } from "@/domain/account/schemas";
import type { RelicLoadout } from "../team/input";

export const RELIC_SLOTS: readonly RelicSlot[] = [
  "head",
  "hands",
  "body",
  "feet",
  "planarSphere",
  "linkRope",
];

export const CAVERN_SLOTS: readonly RelicSlot[] = [
  "head",
  "hands",
  "body",
  "feet",
];
export const PLANAR_SLOTS: readonly RelicSlot[] = ["planarSphere", "linkRope"];

export type RollQuality = "low" | "average" | "high";

/**
 * Relic value tables for 5★ pieces, as decimals. The app layer builds them
 * from the progression catalog (main/sub affix groups of 5★ pieces).
 */
export interface RelicTables {
  /** Main stat at max level for a slot and property. */
  mainStatValue(slot: RelicSlot, propertyId: string): number | undefined;
  /** Main stat properties a slot can roll. */
  mainStatOptions(slot: RelicSlot): readonly string[];
  /** One substat roll of a property at the given quality. */
  substatRoll(propertyId: string, quality: RollQuality): number;
  readonly substatProperties: readonly string[];
}

/** One owned or generated piece, with decimal stats (main stat included). */
export interface RelicPiece {
  readonly key: string;
  readonly slot: RelicSlot;
  readonly setId: string;
  readonly mainStat: string;
  readonly stats: Readonly<Record<string, number>>;
}

export type SixPieces = Readonly<Partial<Record<RelicSlot, RelicPiece>>>;

export function loadoutOf(pieces: SixPieces): RelicLoadout {
  const stats: Record<string, number> = {};
  const sets: Record<string, number> = {};
  for (const piece of Object.values(pieces)) {
    if (!piece) continue;
    for (const [property, value] of Object.entries(piece.stats)) {
      stats[property] = (stats[property] ?? 0) + value;
    }
    sets[piece.setId] = (sets[piece.setId] ?? 0) + 1;
  }
  return { stats, sets };
}

/** Set combination a loadout activates: 2/4-piece Cavern and 2-piece Planar. */
export function setSignature(sets: Readonly<Record<string, number>>): string {
  return Object.entries(sets)
    .filter(([, count]) => count >= 2)
    .map(([id, count]) => `${id}:${count >= 4 ? 4 : 2}`)
    .sort()
    .join(",");
}

/** A set plan the optimizer and generator can target. */
export interface SetPlan {
  /** Four-piece Cavern set, or two two-piece sets, or none. */
  readonly cavern:
    | { fourPiece: string }
    | { twoPlusTwo: readonly [string, string] }
    | null;
  /** Two-piece Planar Ornament set, or none. */
  readonly planar: string | null;
}

export function planSets(plan: SetPlan): Record<string, number> {
  const sets: Record<string, number> = {};
  if (plan.cavern && "fourPiece" in plan.cavern)
    sets[plan.cavern.fourPiece] = 4;
  if (plan.cavern && "twoPlusTwo" in plan.cavern) {
    for (const id of plan.cavern.twoPlusTwo) sets[id] = (sets[id] ?? 0) + 2;
  }
  if (plan.planar) sets[plan.planar] = 2;
  return sets;
}

export function planKey(plan: SetPlan): string {
  return setSignature(planSets(plan));
}
