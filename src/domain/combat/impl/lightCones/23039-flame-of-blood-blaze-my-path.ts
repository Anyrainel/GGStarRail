import { defineLightCone } from "../../kit/equipment";

/**
 * Flame of Blood, Blaze My Path — Destruction. Max HP and Incoming Healing
 * are applied from catalog properties.
 */
export default defineLightCone("23039", (k) => {
  const vista = k.status({
    id: "vista",
    origin: "lightCone",
    modifiers: [{ stat: "dmgBoost", value: k.s(3) }],
  });
  const vistaExtra = k.status({
    id: "vista-extra",
    origin: "lightCone",
    modifiers: [{ stat: "dmgBoost", value: k.s(5) }],
  });
  const kinds = { abilityKinds: ["skill", "ultimate"] } as const;
  // The cost stops at 1 HP, so a low-HP cast consumes less and may miss the
  // extra DMG. Consumed HP feeds the wearer's own HP-loss mechanics.
  k.on("actionStart", "lightCone", kinds, (ctx) => {
    const consumed = ctx.consumeHp(ctx.self, k.s(2)) / ctx.weight;
    ctx.applyStatus(ctx.self, vista);
    if (consumed * ctx.self.currentStat("hp") > k.s(4)) {
      ctx.applyStatus(ctx.self, vistaExtra);
    }
  });
  k.on("actionEnd", "lightCone", kinds, (ctx) => {
    ctx.removeStatus(ctx.self, vista);
    ctx.removeStatus(ctx.self, vistaExtra);
  });
});
