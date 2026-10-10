import { defineLightCone } from "../../kit/equipment";

/** In the Night — The Hunt. CRIT Rate is applied from catalog properties. */
export default defineLightCone("23001", (k) => {
  const spdStacks = {
    source: "holder" as const,
    stat: "spd" as const,
    threshold: 100,
    step: k.s(2),
  };
  const maxStacks = k.s(5);
  k.stat("lightCone", {
    stat: "dmgBoost",
    filter: { tags: ["basic", "skill"] },
    scaling: { ...spdStacks, ratio: k.s(3), cap: k.s(3) * maxStacks },
  });
  k.stat("lightCone", {
    stat: "critDmg",
    filter: { tags: ["ultimate"] },
    scaling: { ...spdStacks, ratio: k.s(4), cap: k.s(4) * maxStacks },
  });
});
