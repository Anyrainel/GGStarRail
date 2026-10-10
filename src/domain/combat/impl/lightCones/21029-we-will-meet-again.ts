import { defineLightCone } from "../../kit/equipment";

/** We Will Meet Again — Nihility. */
export default defineLightCone("21029", (k) => {
  // One random attacked enemy: each enemy the action hit takes an equal share.
  k.on(
    "actionEnd",
    "lightCone",
    { abilityKinds: ["basic", "skill"], attack: true },
    (ctx, event) => {
      const attacked = event.targetsHit ?? [];
      for (const enemy of attacked) {
        ctx.deal(
          { shape: "single", main: k.s(1), onlyTags: ["additional"] },
          { targets: [enemy], origin: "lightCone", weight: 1 / attacked.length }
        );
      }
    }
  );
});
