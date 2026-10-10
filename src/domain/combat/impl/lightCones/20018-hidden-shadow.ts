import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Hidden Shadow — Nihility. */
export default defineLightCone("20018", (k) => {
  // Held from a Skill until the next Basic ATK consumes it.
  const mechanism = k.status({ id: "mechanism", origin: "lightCone" });
  k.on("actionEnd", "lightCone", { abilityKinds: ["skill"] }, (ctx) =>
    ctx.applyStatus(ctx.self, mechanism)
  );
  k.on(
    "actionEnd",
    "lightCone",
    {
      abilityKinds: ["basic"],
      attack: true,
      when: (event, self) => isEnemy(event.target) && self.has(mechanism),
    },
    (ctx, event) => {
      if (!isEnemy(event.target)) return;
      ctx.deal(
        { shape: "single", main: k.s(1), onlyTags: ["additional"] },
        { targets: [event.target], origin: "lightCone" }
      );
      ctx.removeStatus(ctx.self, mechanism);
    }
  );
});
