import { defineLightCone } from "../../kit/equipment";
import type { ModifierDef } from "../../kit/model";

/**
 * A Thankless Coronation — Destruction. CRIT DMG is applied from catalog
 * properties.
 */
export default defineLightCone("23045", (k) => {
  const highEnergy = k.wearer.maxEnergy >= k.s(3);
  const modifiers: ModifierDef[] = [{ stat: "atkPct", value: k.s(6) }];
  if (highEnergy) modifiers.push({ stat: "atkPct", value: k.s(2) });
  const kingOfKnights = k.status({
    id: "king-of-knights",
    origin: "lightCone",
    duration: { turns: k.s(4) },
    modifiers,
  });
  // "When using Ultimate": the ATK applies to that Ultimate; the Energy is
  // regenerated after its cost is paid.
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) => {
    ctx.applyStatus(ctx.self, kingOfKnights);
    if (highEnergy) {
      ctx.gainEnergy(ctx.self, k.s(5) * ctx.self.maxEnergy, { fixed: true });
    }
  });
});
