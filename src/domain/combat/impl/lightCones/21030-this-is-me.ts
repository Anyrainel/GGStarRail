import { defineLightCone } from "../../kit/equipment";

/** This Is Me! — Preservation. DEF is applied from catalog properties. */
export default defineLightCone("21030", (k) => {
  // DMG equal to #2 of DEF, added once to each enemy the Ultimate hit: a
  // silent DEF-scaled part of the Ultimate DMG.
  k.on(
    "actionEnd",
    "lightCone",
    { abilityKinds: ["ultimate"], attack: true },
    (ctx, event) => {
      const targets = event.targetsHit ?? [];
      if (targets.length === 0) return;
      ctx.deal(
        { shape: "aoe", each: k.s(2), stat: "def", silent: true },
        {
          targets,
          tags: ["ultimate"],
          abilityKind: "ultimate",
          origin: "lightCone",
        }
      );
    }
  );
});
