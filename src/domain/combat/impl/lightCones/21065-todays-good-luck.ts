import { defineLightCone } from "../../kit/equipment";

/** Today's Good Luck — Elation. CRIT Rate is applied from catalog properties. */
export default defineLightCone("21065", (k) => {
  // The text gives the stacks no duration: they last for the battle.
  const decision = k.status({
    id: "todays-good-luck-decision",
    origin: "lightCone",
    maxStacks: k.s(3),
    modifiers: [{ stat: "elation", value: k.s(2) }],
  });
  k.on("actionStart", "lightCone", { abilityKinds: ["elationSkill"] }, (ctx) =>
    ctx.applyStatus(ctx.self, decision, { stacks: ctx.weight })
  );
});
