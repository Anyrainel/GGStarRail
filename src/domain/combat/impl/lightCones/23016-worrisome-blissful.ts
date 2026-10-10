import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Worrisome, Blissful — The Hunt. CRIT Rate is applied from catalog
 * properties.
 */
export default defineLightCone("23016", (k) => {
  k.stat("lightCone", {
    stat: "dmgBoost",
    value: k.s(2),
    filter: { tags: ["followUp"] },
  });

  const maxTame = k.s(4);
  const tame = k.status({
    id: "tame",
    origin: "lightCone",
    debuff: true,
    maxStacks: maxTame,
  });
  // Hit filters see statuses, not stacks: each stack beyond the first also
  // places a marker (not a debuff), and every level grants one stack's CRIT
  // DMG to allies hitting the target.
  const levels = [tame];
  for (let level = 2; level <= maxTame; level += 1) {
    levels.push(k.status({ id: `tame-${level}`, origin: "lightCone" }));
  }
  for (const level of levels) {
    k.teamStat("lightCone", {
      stat: "critDmg",
      value: k.s(3),
      filter: { targetStatuses: [level.id] },
    });
  }

  // Tame never expires and caps after a few Follow-Up ATKs, so chance-based
  // Follow-Up ATKs apply a whole stack.
  k.on(
    "actionEnd",
    "lightCone",
    { abilityKinds: ["followUp"] },
    (ctx, event) => {
      const target = isEnemy(event.target)
        ? event.target
        : (event.targetsHit?.[0] ?? ctx.mainTarget);
      if (!target) return;
      ctx.applyStatus(target, tame);
      const stacks = target.stacks(tame, ctx.self);
      levels.forEach((level, index) => {
        if (index > 0 && stacks >= index + 1 - 1e-9) {
          ctx.applyStatus(target, level);
        }
      });
    }
  );
});
