import { defineLightCone } from "../../kit/equipment";

/**
 * Ninja Record: Sound Hunt — Destruction. Max HP is applied from catalog
 * properties.
 */
export default defineLightCone("22003", (k) => {
  const curtainsUp = k.status({
    id: "curtains-up",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "critDmg", value: k.s(2) }],
  });
  // Enemy hits cost HP; the aggro share is the chance the wearer was hit.
  k.on("hitByEnemy", "lightCone", { limitPerTurn: 1 }, (ctx) =>
    ctx.applyStatus(ctx.self, curtainsUp, { stacks: ctx.weight })
  );
  // HP is not simulated. When on, the wearer's own HP costs or an ally's
  // healing change its HP before each of its actions.
  const hpChanges = k.toggle("hp-changes", "lightCone", "active", true);
  if (hpChanges) {
    k.on("actionStart", "lightCone", { limitPerTurn: 1 }, (ctx) =>
      ctx.applyStatus(ctx.self, curtainsUp)
    );
  }
});
