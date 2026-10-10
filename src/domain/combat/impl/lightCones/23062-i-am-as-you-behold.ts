import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * I Am As You Behold — Destruction. ATK and Energy Regeneration Rate are
 * applied from catalog properties.
 */
export default defineLightCone("23062", (k) => {
  // Energy consumed is read as the wearer's max Energy: Ultimates with
  // another cost (Yunli, Phainon) are not distinguished.
  const atWill = k.status({
    id: "at-will",
    origin: "lightCone",
    modifiers: [
      {
        stat: "dmgBoost",
        filter: { tags: ["ultimate"] },
        scaling: {
          source: "holder",
          stat: "maxEnergy",
          ratio: k.s(3),
          cap: k.s(6),
        },
      },
    ],
  });
  const ultimate = { abilityKinds: ["ultimate"] } as const;
  k.on("actionStart", "lightCone", ultimate, (ctx) =>
    ctx.applyStatus(ctx.self, atWill)
  );
  k.on("actionEnd", "lightCone", ultimate, (ctx) =>
    ctx.removeStatus(ctx.self, atWill)
  );

  // King's Entertainment lasts for the wearer's turns while it buffs every
  // ally, so each ally's copy counts down on the wearer's clock.
  const kingsEntertainment = k.status({
    id: "kings-entertainment",
    origin: "lightCone",
    unique: true,
    duration: { turns: k.s(4), clock: "applier" },
    modifiers: [{ stat: "critDmg", value: k.s(5) }],
  });
  const entertain = (ctx: BattleApi) => {
    for (const ally of ctx.allies) ctx.applyStatus(ally, kingsEntertainment);
  };
  k.on("battleStart", "lightCone", { subject: "any" }, entertain);
  k.on("actionStart", "lightCone", ultimate, entertain);
});
