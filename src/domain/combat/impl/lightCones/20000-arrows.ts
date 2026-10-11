import { defineLightCone } from "../../kit/equipment";

/** Arrows — The Hunt. */
export default defineLightCone("20000", (k) => {
  const crisis = k.status({
    id: "crisis",
    origin: "lightCone",
    duration: { turns: k.s(2) },
    modifiers: [{ stat: "critRate", value: k.s(1) }],
  });
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) =>
    ctx.applyStatus(ctx.self, crisis)
  );
});
