import { defineLightCone } from "../../kit/equipment";

const BASICS = "lc23033:raiton-basic-atks";

/**
 * Ninjutsu Inscription: Dazzling Evilbreaker — Erudition. Break Effect is
 * applied from catalog properties.
 */
export default defineLightCone("23033", (k) => {
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) =>
    ctx.gainEnergy(ctx.self, k.s(2))
  );

  const raiton = k.status({ id: "raiton", origin: "lightCone" });
  // Every Ultimate (re)sets "Raiton" and its Basic ATK count.
  k.on("actionEnd", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) => {
    ctx.applyStatus(ctx.self, raiton);
    ctx.setCounter(ctx.self, BASICS, 0);
  });
  k.on(
    "actionEnd",
    "lightCone",
    {
      abilityKinds: ["basic"],
      when: (_event, self) => self.has(raiton),
    },
    (ctx) => {
      ctx.addCounter(ctx.self, BASICS, 1);
      // "After using 2 Basic ATKs" has no placeholder.
      if (ctx.self.counter(BASICS) + 1e-9 < 2) return;
      ctx.advanceAction(ctx.self, k.s(3));
      ctx.removeStatus(ctx.self, raiton);
    }
  );
});
