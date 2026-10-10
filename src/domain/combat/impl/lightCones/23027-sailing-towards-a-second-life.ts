import { defineLightCone } from "../../kit/equipment";

/**
 * Sailing Towards a Second Life — The Hunt. Break Effect is applied from
 * catalog properties.
 */
export default defineLightCone("23027", (k) => {
  k.stat("lightCone", {
    stat: "defIgnore",
    value: k.s(3),
    filter: { tags: ["break"] },
  });
  // A battle-long status rather than k.stat: turn order reads scaled SPD
  // from statuses only.
  const roughWater = k.status({
    id: "rough-water-spd",
    origin: "lightCone",
    modifiers: [
      {
        stat: "spdPct",
        scaling: {
          source: "holder",
          stat: "breakEffect",
          atLeast: k.s(2),
          ratio: k.s(4),
        },
      },
    ],
  });
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) =>
    ctx.applyStatus(ctx.self, roughWater)
  );
});
