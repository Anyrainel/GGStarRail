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

  // Break DMG from the wearer: Weakness Breaks, Super Break DMG, and its
  // Break DoTs (ticks and detonations). breakDamage also reports Toughness
  // reduced on Broken enemies without a Super Break conversion, which deals
  // no DMG, so Super Break needs the wearer's current conversion (scaled and
  // filtered conversions, such as Firefly's, are not seen:
  // engine-break-damage-no-conversion).
  k.on(
    "breakDamage",
    "lightCone",
    {
      when: (event, self) =>
        !event.tags?.includes("superBreak") ||
        self.currentStat("superBreakDmg") > 0,
    },
    (ctx, event) => {
      if (isEnemy(event.target)) ctx.applyStatus(event.target, routed);
    }
  );
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
