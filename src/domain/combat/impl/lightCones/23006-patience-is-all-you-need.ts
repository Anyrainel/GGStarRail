import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Patience Is All You Need — Nihility. DMG dealt is applied from catalog
 * properties.
 */
export default defineLightCone("23006", (k) => {
  const spiderWeb = k.status({
    id: "patience-spd",
    origin: "lightCone",
    maxStacks: k.s(4),
    modifiers: [{ stat: "spdPct", value: k.s(3) }],
  });
  k.on("actionEnd", "lightCone", { attack: true }, (ctx) =>
    ctx.applyStatus(ctx.self, spiderWeb, { stacks: ctx.weight })
  );

  const erode = k.status({
    id: "erode",
    origin: "lightCone",
    debuff: true,
    // "Also considered to be Shocked."
    family: "shock",
    duration: { turns: k.s(5) },
    dot: {
      hit: {
        shape: "single",
        main: k.s(1),
        kind: "dot",
        combatType: "Thunder",
      },
    },
  });
  k.on(
    "hit",
    "lightCone",
    { when: (event) => isEnemy(event.target) && !event.target.has(erode) },
    (ctx, event) => {
      // "100% base chance" is printed without a placeholder.
      if (isEnemy(event.target)) {
        ctx.applyStatus(event.target, erode, { baseChance: 1 });
      }
    }
  );
});
