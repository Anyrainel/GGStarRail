import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** If Time Were a Flower — Harmony. CRIT DMG is applied from catalog properties. */
export default defineLightCone("23038", (k) => {
  const presage = k.status({
    id: "if-time-were-a-flower-presage",
    origin: "lightCone",
    duration: { turns: k.s(3) },
  });
  // Counts down on the wearer's turns, so it ends together with Presage.
  const presageAllies = k.status({
    id: "if-time-were-a-flower-presage-allies",
    origin: "lightCone",
    duration: { turns: k.s(3), clock: "applier" },
    modifiers: [{ stat: "critDmg", value: k.s(4) }],
  });
  const gainPresage = (ctx: BattleApi, turns: number) => {
    ctx.applyStatus(ctx.self, presage, { turns });
    for (const ally of ctx.allies) {
      ctx.applyStatus(ally, presageAllies, { turns });
    }
  };
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    ctx.gainEnergy(ctx.self, k.s(5));
    gainPresage(ctx, k.s(6));
  });
  k.on("actionEnd", "lightCone", { abilityKinds: ["followUp"] }, (ctx) => {
    ctx.gainEnergy(ctx.self, k.s(2));
    gainPresage(ctx, k.s(3));
  });
});
