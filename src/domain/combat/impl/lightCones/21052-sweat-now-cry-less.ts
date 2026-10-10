import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Sweat Now, Cry Less — Remembrance. CRIT Rate is applied from catalog properties. */
export default defineLightCone("21052", (k) => {
  // The memosprite is on the field whenever it deals DMG. Memosprites copy
  // their owner's permanent modifiers, so this reaches only the wearer's.
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(2),
    filter: { attackerKinds: ["memosprite"] },
  });
  // The wearer's part follows the memosprite's presence.
  const comeTrain = k.status({
    id: "sweat-now-cry-less-dmg",
    origin: "lightCone",
    modifiers: [{ stat: "dmgBoost", value: k.s(2) }],
  });
  const sync = (ctx: BattleApi) => {
    const present = ctx.allies.some(
      (unit) => unit.kind === "memosprite" && unit.owner === ctx.self
    );
    if (present && !ctx.self.has(comeTrain)) {
      ctx.applyStatus(ctx.self, comeTrain);
    } else if (!present && ctx.self.has(comeTrain)) {
      ctx.removeStatus(ctx.self, comeTrain);
    }
  };
  k.on("summoned", "lightCone", { subject: "memosprite" }, sync);
  k.on("departed", "lightCone", { subject: "memosprite" }, sync);
});
