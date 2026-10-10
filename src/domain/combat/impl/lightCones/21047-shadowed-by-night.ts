import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** Shadowed by Night — The Hunt. Break Effect is applied from catalog properties. */
export default defineLightCone("21047", (k) => {
  const concealment = k.status({
    id: "concealment-spd",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [{ stat: "spdPct", value: k.s(2) }],
  });
  const grant = (ctx: BattleApi) => ctx.applyStatus(ctx.self, concealment);
  // "Once per turn" is a limit on each trigger: a second trigger in the same
  // turn would only refresh the same duration.
  k.on("battleStart", "lightCone", { subject: "any" }, grant);
  // Break DMG dealt by the wearer: the Weakness Break itself, Break-kind
  // procs (e.g. Boothill's Talent), and its Break DoTs ticking or detonated.
  k.on("weaknessBreak", "lightCone", { limitPerTurn: 1 }, grant);
  k.on("hit", "lightCone", { tags: ["break"], limitPerTurn: 1 }, grant);
  k.on(
    "dotTick",
    "lightCone",
    {
      subject: "enemy",
      limitPerTurn: 1,
      when: (event, self) =>
        event.status?.dot?.hit.kind === "break" &&
        event.unit.has(event.status, self),
    },
    grant
  );
});
