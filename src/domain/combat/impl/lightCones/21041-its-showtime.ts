import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** It's Showtime — Nihility. */
export default defineLightCone("21041", (k) => {
  const trick = k.status({
    id: "trick",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    maxStacks: k.s(2),
    modifiers: [{ stat: "dmgBoost", value: k.s(1) }],
  });
  k.on(
    "statusApplied",
    "lightCone",
    { when: (event) => isEnemy(event.target) && event.status?.debuff === true },
    (ctx) => ctx.applyStatus(ctx.self, trick)
  );
  k.stat("lightCone", {
    stat: "atkPct",
    scaling: {
      source: "holder",
      stat: "effectHitRate",
      atLeast: k.s(4),
      ratio: k.s(5),
    },
  });
});
