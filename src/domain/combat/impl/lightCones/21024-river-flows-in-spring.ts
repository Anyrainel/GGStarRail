import { defineLightCone } from "../../kit/equipment";

/** River Flows in Spring — The Hunt. */
export default defineLightCone("21024", (k) => {
  // Stacks are the expected presence of the effect (at most 1).
  const staveOff = k.status({
    id: "stave-off-the-lingering-cold",
    origin: "lightCone",
    modifiers: [
      { stat: "spdPct", value: k.s(1) },
      { stat: "dmgBoost", value: k.s(2) },
    ],
  });
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) =>
    ctx.applyStatus(ctx.self, staveOff)
  );
  // An enemy attack hits the wearer with its aggro share as the weight.
  k.on("hitByEnemy", "lightCone", {}, (ctx) => {
    const presence = ctx.self.stacks(staveOff);
    if (presence <= 0) return;
    ctx.setStatusStacks(
      ctx.self,
      staveOff,
      presence * (1 - Math.min(1, ctx.weight))
    );
  });
  k.on(
    "turnEnd",
    "lightCone",
    { when: (_event, self) => self.stacks(staveOff) < 1 - 1e-9 },
    (ctx) => ctx.applyStatus(ctx.self, staveOff, { setStacks: 1 })
  );
});
