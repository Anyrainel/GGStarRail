import { defineLightCone } from "../../kit/equipment";

/** The Flower Remembers — Remembrance. CRIT DMG is applied from catalog properties. */
export default defineLightCone("21057", (k) => {
  // Memosprites copy their owner's permanent modifiers, so this reaches only
  // the wearer's memosprite, on top of the shared catalog CRIT DMG.
  k.stat("lightCone", {
    stat: "critDmg",
    value: k.s(2),
    filter: { attackerKinds: ["memosprite"] },
  });
});
