import { isEnemy, type UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Elation Brimming With Blessings — Elation. ATK is applied from catalog
 * properties.
 */
export default defineLightCone("24006", (k) => {
  const opening = k.status({
    id: "elation-brimming-with-blessings-opening",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "elation", value: k.s(2) }],
  });
  const isAllyCharacter = (unit: UnitView | undefined): unit is UnitView =>
    unit !== undefined && !isEnemy(unit) && unit.kind === "character";

  // "On one ally character" (我方单体角色): a Skill or Ultimate aimed at one
  // ally, whose target is a Character.
  k.on(
    "actionEnd",
    "lightCone",
    {
      abilityKinds: ["skill", "ultimate"],
      when: (event) =>
        event.abilityTarget === "ally" && isAllyCharacter(event.target),
    },
    (ctx, event) => {
      if (isAllyCharacter(event.target)) {
        ctx.applyStatus(event.target, opening);
      }
    }
  );
});
