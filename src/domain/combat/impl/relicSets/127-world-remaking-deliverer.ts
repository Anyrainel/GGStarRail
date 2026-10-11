import type { BattleApi, UnitView } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";

function memospritesOf(ctx: BattleApi): UnitView[] {
  return ctx.allies.filter(
    (unit) => unit.kind === "memosprite" && unit.owner?.id === ctx.self.id
  );
}

/** World-Remaking Deliverer. CRIT Rate is applied from catalog properties. */
export default defineRelicSet("127", {
  fourPiece: (k) => {
    const maxHp = k.status({
      id: "deliverer-max-hp",
      origin: "relic4pc",
      modifiers: [{ stat: "hpPct", value: k.param(1) }],
    });
    const dmg = k.status({
      id: "deliverer-dmg",
      origin: "relic4pc",
      modifiers: [{ stat: "dmgBoost", value: k.param(2) }],
      unique: true,
    });
    // "Until after the wearer's next Basic ATK or Skill": each use ends the
    // previous effect and starts a new one while the memosprite is present.
    k.on(
      "actionEnd",
      "relic4pc",
      { abilityKinds: ["basic", "skill"] },
      (ctx) => {
        for (const ally of ctx.allies) {
          ctx.removeStatus(ally, maxHp);
          ctx.removeStatus(ally, dmg);
        }
        const memosprites = memospritesOf(ctx);
        if (memosprites.length === 0) return;
        for (const ally of ctx.allies) ctx.applyStatus(ally, dmg);
        for (const unit of [ctx.self, ...memosprites]) {
          ctx.applyStatus(unit, maxHp);
        }
      }
    );
  },
});
