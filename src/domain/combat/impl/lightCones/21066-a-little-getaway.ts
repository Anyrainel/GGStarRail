import { defineLightCone } from "../../kit/equipment";

/** A Little Getaway — Elation. Elation is applied from catalog properties. */
export default defineLightCone("21066", (k) => {
  const whisper = k.status({
    id: "a-little-getaway-whisper",
    origin: "lightCone",
    modifiers: [{ stat: "defIgnore", value: k.s(2) }],
  });
  const elationSkill = { abilityKinds: ["elationSkill"] } as const;
  k.on("actionStart", "lightCone", elationSkill, (ctx) =>
    ctx.applyStatus(ctx.self, whisper)
  );
  k.on("actionEnd", "lightCone", elationSkill, (ctx) =>
    ctx.removeStatus(ctx.self, whisper)
  );
});
