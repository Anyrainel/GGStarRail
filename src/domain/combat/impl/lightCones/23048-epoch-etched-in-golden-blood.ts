import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Epoch Etched in Golden Blood — Harmony. ATK is applied from catalog
 * properties.
 */
export default defineLightCone("23048", (k) => {
  k.on(
    "actionEnd",
    "lightCone",
    { abilityKinds: ["ultimate"], attack: true },
    (ctx) => ctx.gainSkillPoints(k.s(3))
  );

  const conquer = k.status({
    id: "epoch-etched-in-golden-blood",
    origin: "lightCone",
    duration: { turns: k.s(5) },
    modifiers: [
      { stat: "dmgBoost", value: k.s(4), filter: { tags: ["skill"] } },
    ],
  });
  k.on(
    "actionEnd",
    "lightCone",
    {
      abilityKinds: ["skill"],
      when: (event) =>
        !isEnemy(event.target) && event.target?.kind === "character",
    },
    (ctx, event) => {
      if (event.target) ctx.applyStatus(event.target, conquer);
    }
  );
});
