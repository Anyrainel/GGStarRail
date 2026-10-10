import type { UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

const SPENT = "never-forget-her-flame:spent";
const ACTION = "never-forget-her-flame:action";
const weaknessSeen = (wearerId: string, type: string) =>
  `never-forget-her-flame:${wearerId}:weakness:${type}`;

/**
 * Never Forget Her Flame — Nihility. Break Effect is applied from catalog
 * properties.
 */
export default defineLightCone("23050", (k) => {
  const immolation = k.status({
    id: "never-forget-her-flame",
    origin: "lightCone",
    unique: true,
    modifiers: [
      { stat: "dmgBoost", value: k.s(2), filter: { tags: ["break"] } },
    ],
  });
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    ctx.applyStatus(ctx.self, immolation);
    // The teammate who triggered combat is unknown: use the fallback, the
    // teammate with the highest Break Effect (team order breaks ties).
    let partner: UnitView | null = null;
    for (const ally of ctx.allies) {
      if (ally.kind !== "character" || ally === ctx.self) continue;
      if (
        !partner ||
        ally.panelStat("breakEffect") > partner.panelStat("breakEffect") + 1e-9
      ) {
        partner = ally;
      }
    }
    if (partner) ctx.applyStatus(partner, immolation);
  });

  // The Engine has no event for implanted Weaknesses: a Weakness that an
  // enemy gains during the wearer's own action counts as applied by them.
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.setCounter(ctx.self, SPENT, 0)
  );
  k.on("actionStart", "lightCone", {}, (ctx) => {
    const action = ctx.self.counter(ACTION) + 1;
    ctx.setCounter(ctx.self, ACTION, action);
    for (const enemy of ctx.enemies) {
      for (const type of enemy.weaknesses) {
        ctx.setCounter(enemy, weaknessSeen(ctx.self.id, type), action);
      }
    }
  });
  k.on(
    "actionEnd",
    "lightCone",
    { when: (_event, self) => self.counter(SPENT) <= 0 },
    (ctx) => {
      const action = ctx.self.counter(ACTION);
      const implanted = ctx.enemies.some((enemy) =>
        [...enemy.weaknesses].some(
          (type) => enemy.counter(weaknessSeen(ctx.self.id, type)) !== action
        )
      );
      if (!implanted) return;
      ctx.setCounter(ctx.self, SPENT, 1);
      ctx.gainSkillPoints(1);
    }
  );
});
