import { defineLightCone } from "../../kit/equipment";

/**
 * Moment of Victory — Preservation. DEF and Effect Hit Rate are applied
 * from catalog properties.
 */
export default defineLightCone("23005", (k) => {
  // The aggro increase is not modeled (engine-gap).
  const verdict = k.status({
    id: "verdict",
    origin: "lightCone",
    modifiers: [{ stat: "defPct", value: k.s(3) }],
  });
  // Enemy attacks reach the wearer with its aggro share, so the buff is held
  // with that probability.
  k.on("hitByEnemy", "lightCone", {}, (ctx) =>
    ctx.applyStatus(ctx.self, verdict, { stacks: ctx.weight })
  );
  k.on("turnEnd", "lightCone", {}, (ctx) =>
    ctx.removeStatus(ctx.self, verdict)
  );
});
