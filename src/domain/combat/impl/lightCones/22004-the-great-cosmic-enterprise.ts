import { defineLightCone } from "../../kit/equipment";
import type { CombatType } from "../../model/stats";

const COMBAT_TYPES: readonly CombatType[] = [
  "Physical",
  "Fire",
  "Ice",
  "Thunder",
  "Wind",
  "Quantum",
  "Imaginary",
];

/**
 * The Great Cosmic Enterprise — Erudition. ATK is applied from catalog
 * properties.
 */
export default defineLightCone("22004", (k) => {
  // One modifier per Combat Type: the bonus counts the Weakness Types the
  // target holds when hit, implanted ones included. There are only 7 types,
  // so the "max of 7" cap always holds.
  for (const type of COMBAT_TYPES) {
    k.stat("lightCone", {
      stat: "dmgBoost",
      value: k.s(2),
      filter: { targetWeakness: [type] },
    });
  }
});
