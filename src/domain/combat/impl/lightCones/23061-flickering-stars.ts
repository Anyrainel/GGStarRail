import type { BattleApi, UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/** The Character a memosprite or summon belongs to. */
function character(unit: UnitView): UnitView {
  return unit.kind !== "character" && unit.owner ? unit.owner : unit;
}

/** Flickering Stars — Erudition. CRIT Rate is applied from catalog properties. */
export default defineLightCone("23061", (k) => {
  const radiantCrown = k.status({
    id: "radiant-crown",
    origin: "lightCone",
    unique: true,
    duration: { turns: k.s(4) },
    modifiers: [
      { stat: "dmgBoost", value: k.s(2), filter: { tags: ["skill"] } },
    ],
  });
  // "While the wearer holds Radiant Crown, all allies ignore DEF": held by
  // every ally on the wearer's clock, so it expires with the Crown.
  const crownDefIgnore = k.status({
    id: "radiant-crown-def-ignore",
    origin: "lightCone",
    unique: true,
    duration: { turns: k.s(4), clock: "applier" },
    modifiers: [{ stat: "defIgnore", value: k.s(5) }],
  });

  // Skill Points each ally Character consumed during its own current turn
  // (memosprite and summon actions count for their owner). Counters live on
  // the ally, keyed by the wearer.
  const spentKey = (ctx: BattleApi) => `lc23061:${ctx.self.id}:spent`;
  const inTurnKey = (ctx: BattleApi) => `lc23061:${ctx.self.id}:in-turn`;
  k.on(
    "turnStart",
    "lightCone",
    { subject: "ally", when: (event) => event.unit.kind === "character" },
    (ctx, event) => {
      ctx.setCounter(event.unit, spentKey(ctx), 0);
      ctx.setCounter(event.unit, inTurnKey(ctx), 1);
    }
  );
  k.on(
    "turnEnd",
    "lightCone",
    { subject: "ally", when: (event) => event.unit.kind === "character" },
    (ctx, event) => ctx.setCounter(event.unit, inTurnKey(ctx), 0)
  );
  k.on(
    "skillPointsChanged",
    "lightCone",
    { subject: "ally", when: (event) => (event.delta ?? 0) < 0 },
    (ctx, event) => {
      const ally = character(event.unit);
      if (ally.counter(inTurnKey(ctx)) <= 0) return;
      const before = ally.counter(spentKey(ctx));
      const after = before - (event.delta ?? 0);
      ctx.setCounter(ally, spentKey(ctx), after);
      if (before + 1e-9 >= k.s(3) || after + 1e-9 < k.s(3)) return;
      ctx.applyStatus(ctx.self, radiantCrown);
      for (const unit of ctx.allies) ctx.applyStatus(unit, crownDefIgnore);
    }
  );
});
