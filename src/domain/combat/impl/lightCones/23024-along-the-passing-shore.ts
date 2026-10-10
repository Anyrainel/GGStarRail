import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

const ACTION = "along-the-passing-shore:action";
const inflicted = (wearerId: string) =>
  `along-the-passing-shore:${wearerId}:inflicted`;

/**
 * Along the Passing Shore — Nihility. CRIT DMG is applied from catalog
 * properties.
 */
export default defineLightCone("23024", (k) => {
  const mirageFizzle = k.status({
    id: "mirage-fizzle",
    origin: "lightCone",
    debuff: true,
    // "Lasting for 1 turn" is printed without a placeholder.
    duration: { turns: 1 },
  });
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(2),
    filter: { targetStatuses: [mirageFizzle.id] },
  });
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(3),
    filter: { targetStatuses: [mirageFizzle.id], tags: ["ultimate"] },
  });

  // "Only 1 time on each target" per attack: every action is a new attack,
  // and a target records the last action that inflicted it.
  k.on("actionStart", "lightCone", { subject: "any" }, (ctx) =>
    ctx.setCounter(ctx.self, ACTION, ctx.self.counter(ACTION) + 1)
  );
  k.on(
    "hit",
    "lightCone",
    {
      when: (event, self) =>
        isEnemy(event.target) &&
        event.target.counter(inflicted(self.id)) !== self.counter(ACTION),
    },
    (ctx, event) => {
      if (!isEnemy(event.target)) return;
      ctx.setCounter(
        event.target,
        inflicted(ctx.self.id),
        ctx.self.counter(ACTION)
      );
      ctx.applyStatus(event.target, mirageFizzle);
    }
  );
});
