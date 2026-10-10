import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Whereabouts Should Dreams Rest — Destruction. Break Effect is applied from
 * catalog properties.
 */
export default defineLightCone("23025", (k) => {
  const routed = k.status({
    id: "routed",
    origin: "lightCone",
    debuff: true,
    unique: true,
    family: "slow",
    duration: { turns: k.s(4) },
    modifiers: [{ stat: "spdPct", value: -k.s(3) }],
  });
  // "Receive increased Break DMG from the wearer" cannot be scoped to one
  // attacker on the enemy (engine-gap), so the wearer holds it as a separate
  // multiplier on its Break DMG (Super Break and Break DoTs included) against
  // Routed targets.
  k.stat("lightCone", {
    stat: "dmgMultiplier",
    value: k.s(2),
    filter: { tags: ["break"], targetStatuses: [routed.id] },
  });

  // Break DMG from the wearer: the Weakness Break itself and its Break DoTs
  // (ticks and detonations). Super Break DMG has no event (engine-gap).
  k.on("weaknessBreak", "lightCone", {}, (ctx, event) => {
    if (isEnemy(event.target)) ctx.applyStatus(event.target, routed);
  });
  k.on(
    "dotTick",
    "lightCone",
    {
      subject: "enemy",
      when: (event, self) =>
        event.status?.dot?.hit.kind === "break" &&
        event.unit.has(event.status, self),
    },
    (ctx, event) => ctx.applyStatus(event.unit, routed)
  );
});
