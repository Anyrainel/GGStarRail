import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * The Finale of a Lie — The Hunt. CRIT Rate is applied from catalog
 * properties.
 */
export default defineLightCone("23056", (k) => {
  const turns = k.s(3);
  const umbraDevourer = k.status({
    id: "umbra-devourer",
    origin: "lightCone",
    duration: { turns },
    modifiers: [{ stat: "atkPct", value: k.s(4) }],
  });
  // Lasts while the wearer holds Umbra Devourer, so it follows the wearer's
  // turns; the text does not inflict it as a debuff.
  const devoured = k.status({
    id: "umbra-devourer-vulnerability",
    origin: "lightCone",
    duration: { turns, clock: "applier" },
    unique: true,
    modifiers: [{ stat: "vulnerability", value: k.s(5) }],
  });
  const gain = (ctx: BattleApi) => {
    ctx.applyStatus(ctx.self, umbraDevourer);
    for (const enemy of ctx.enemies) ctx.applyStatus(enemy, devoured);
  };

  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => gain(ctx));
  const counter = "the-finale-of-a-lie:follow-ups";
  k.on("actionStart", "lightCone", { abilityKinds: ["followUp"] }, (ctx) => {
    ctx.addCounter(ctx.self, counter, 1);
    if (ctx.self.counter(counter) >= k.s(2) - 1e-9) {
      ctx.setCounter(ctx.self, counter, ctx.self.counter(counter) - k.s(2));
      gain(ctx);
    }
  });
});
