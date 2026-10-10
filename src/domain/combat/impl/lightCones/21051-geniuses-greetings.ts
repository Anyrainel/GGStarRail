import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";
import type { ModifierDef } from "../../kit/model";

/** Geniuses' Greetings — Remembrance. ATK is applied from catalog properties. */
export default defineLightCone("21051", (k) => {
  const basicDmg: ModifierDef = {
    stat: "dmgBoost",
    value: k.s(2),
    filter: { tags: ["basic"] },
  };
  const congratulations = k.status({
    id: "geniuses-greetings-basic",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [basicDmg],
  });
  // The memosprite's copy follows the wearer's buff (memosprites summoned
  // later included) and ends with it.
  const memospriteCopy = k.status({
    id: "geniuses-greetings-basic-memosprite",
    origin: "lightCone",
    modifiers: [basicDmg],
  });
  const sync = (ctx: BattleApi) => {
    const active = ctx.self.has(congratulations);
    for (const unit of ctx.allies) {
      if (unit.kind !== "memosprite" || unit.owner !== ctx.self) continue;
      if (active && !unit.has(memospriteCopy)) {
        ctx.applyStatus(unit, memospriteCopy);
      } else if (!active && unit.has(memospriteCopy)) {
        ctx.removeStatus(unit, memospriteCopy);
      }
    }
  };
  k.on("actionEnd", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) => {
    ctx.applyStatus(ctx.self, congratulations);
    sync(ctx);
  });
  k.on("actionStart", "lightCone", { subject: "any" }, sync);
});
