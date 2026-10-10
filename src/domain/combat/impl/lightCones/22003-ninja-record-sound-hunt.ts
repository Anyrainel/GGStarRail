import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Ninja Record: Sound Hunt — Destruction. Max HP is applied from catalog
 * properties.
 */
export default defineLightCone("22003", (k) => {
  const curtainsUp = k.status({
    id: "curtains-up",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "critDmg", value: k.s(2) }],
  });
  const grant = (ctx: BattleApi) =>
    ctx.applyStatus(ctx.self, curtainsUp, { stacks: ctx.weight });
  // Enemy hits cost HP; the aggro share is the chance the wearer was hit.
  k.on("hitByEnemy", "lightCone", { limitPerTurn: 1 }, grant);
  // HP consumed or restored by any source (heals count at full HP).
  k.on(
    "hpChanged",
    "lightCone",
    {
      limitPerTurn: 1,
      when: (event) => event.hpCause === "consume" || event.hpCause === "heal",
    },
    grant
  );
});
