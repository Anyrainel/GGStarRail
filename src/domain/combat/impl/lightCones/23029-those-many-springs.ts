import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";
import type { StatusDef } from "../../kit/model";

/**
 * Those Many Springs — Nihility. Effect Hit Rate is applied from catalog
 * properties.
 */
export default defineLightCone("23029", (k) => {
  const unarmored = k.status({
    id: "unarmored",
    origin: "lightCone",
    debuff: true,
    duration: { turns: k.s(4) },
    modifiers: [{ stat: "vulnerability", value: k.s(3) }],
  });
  // The upgraded state replaces Unarmored: its #3 plus the additional #6.
  const cornered = k.status({
    id: "cornered",
    origin: "lightCone",
    debuff: true,
    duration: { turns: k.s(4) },
    modifiers: [{ stat: "vulnerability", value: k.s(3) + k.s(6) }],
  });

  // DoTs the wearer has inflicted, Weakness Break DoTs included (Frozen and
  // Entanglement deal Additional DMG, not DoT).
  const ownDots = new Set<StatusDef>();
  k.on(
    "statusApplied",
    "lightCone",
    {
      when: (event) =>
        event.status?.dot !== undefined &&
        event.status.family !== "frozen" &&
        event.status.family !== "entanglement",
    },
    (_ctx, event) => {
      if (event.status) ownDots.add(event.status);
    }
  );

  // Every enemy the attack hit. Cornered is applied with its own base
  // chance, not conditioned on Unarmored having landed.
  k.on(
    "actionEnd",
    "lightCone",
    { abilityKinds: ["basic", "skill", "ultimate"], attack: true },
    (ctx, event) => {
      for (const target of event.targetsHit ?? []) {
        if (!isEnemy(target) || target.has(cornered, ctx.self)) continue;
        ctx.applyStatus(target, unarmored, { baseChance: k.s(2) });
        if ([...ownDots].some((dot) => target.has(dot, ctx.self))) {
          ctx.removeStatus(target, unarmored);
          ctx.applyStatus(target, cornered, { baseChance: k.s(5) });
        }
      }
    }
  );
});
