import type { StatusDef } from "../kit/model";
import type { CombatType } from "../model/stats";
import type { BreakEffect } from "./log";

/**
 * Break DoT coefficients against the attacker-level base. Bleed and
 * Entanglement also scale with the enemy's Toughness factor. Bleed's
 * enemy-Max-HP alternative is not modeled: bosses with large HP pools reach
 * the Toughness-based value, which is what the coefficient encodes.
 */
export const BREAK_EFFECT_COEFFICIENT: Readonly<Record<BreakEffect, number>> = {
  bleed: 2,
  burn: 1,
  frozen: 1,
  shock: 2,
  windShear: 1,
  entanglement: 0.6,
  imprisonment: 0,
};

export const BREAK_EFFECT_USES_TOUGHNESS: Readonly<
  Record<BreakEffect, boolean>
> = {
  bleed: true,
  burn: false,
  frozen: false,
  shock: false,
  windShear: false,
  entanglement: true,
  imprisonment: false,
};

const BREAK_EFFECT_BY_TYPE: Readonly<Record<CombatType, BreakEffect>> = {
  Physical: "bleed",
  Fire: "burn",
  Ice: "frozen",
  Thunder: "shock",
  Wind: "windShear",
  Quantum: "entanglement",
  Imaginary: "imprisonment",
};

export function breakEffectFor(combatType: CombatType): BreakEffect {
  return BREAK_EFFECT_BY_TYPE[combatType];
}

function breakDot(
  id: BreakEffect,
  turns: number,
  combatType: CombatType
): StatusDef {
  return {
    id: `break:${id}`,
    origin: "scenario",
    debuff: true,
    family: id,
    // Frozen enemies skip their turn; Entanglement and Imprisonment delay.
    skipsTurn: id === "frozen",
    duration: { turns },
    maxStacks: id === "windShear" || id === "entanglement" ? 5 : 1,
    dot:
      BREAK_EFFECT_COEFFICIENT[id] > 0
        ? {
            hit: {
              shape: "single",
              main: BREAK_EFFECT_COEFFICIENT[id],
              kind: "break",
              combatType,
            },
          }
        : undefined,
    modifiers:
      id === "imprisonment" ? [{ stat: "spdPct", value: -0.1 }] : undefined,
  };
}

export const BREAK_EFFECT_STATUS: Readonly<Record<BreakEffect, StatusDef>> = {
  bleed: breakDot("bleed", 2, "Physical"),
  burn: breakDot("burn", 2, "Fire"),
  frozen: breakDot("frozen", 1, "Ice"),
  shock: breakDot("shock", 2, "Thunder"),
  windShear: breakDot("windShear", 2, "Wind"),
  entanglement: breakDot("entanglement", 1, "Quantum"),
  imprisonment: breakDot("imprisonment", 1, "Imaginary"),
};
