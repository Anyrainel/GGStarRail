import type { BattleApi, EventFilter } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";
import type { ModifierDef } from "../../kit/model";

/**
 * Make Farewells More Beautiful — Remembrance. Max HP is applied from
 * catalog properties.
 */
export default defineLightCone("23040", (k) => {
  const defIgnore: ModifierDef = { stat: "defIgnore", value: k.s(2) };
  const deathFlower = k.status({
    id: "make-farewells-more-beautiful-death-flower",
    origin: "lightCone",
    duration: { turns: k.s(3) },
    modifiers: [defIgnore],
  });
  // The memosprite ignores DEF while the wearer holds Death Flower.
  const deathFlowerMemosprite = k.status({
    id: "make-farewells-more-beautiful-death-flower-memosprite",
    origin: "lightCone",
    modifiers: [defIgnore],
  });
  const sync = (ctx: BattleApi) => {
    const active = ctx.self.has(deathFlower);
    for (const unit of ctx.allies) {
      if (unit.kind !== "memosprite" || unit.owner !== ctx.self) continue;
      if (active && !unit.has(deathFlowerMemosprite)) {
        ctx.applyStatus(unit, deathFlowerMemosprite);
      } else if (!active && unit.has(deathFlowerMemosprite)) {
        ctx.removeStatus(unit, deathFlowerMemosprite);
      }
    }
  };
  k.on("statusRemoved", "lightCone", { status: deathFlower }, sync);
  k.on("summoned", "lightCone", { subject: "memosprite" }, sync);

  // HP lost by the wearer or its memosprite during either one's turn (extra
  // turns included; countdowns are not their turns).
  const OWN_TURN = "lc23040:own-turn";
  const ownTurn: EventFilter = {
    subject: "selfOrMemosprite",
    when: (event) => event.unit.kind !== "summon",
  };
  k.on("turnStart", "lightCone", ownTurn, (ctx) =>
    ctx.setCounter(ctx.self, OWN_TURN, 1)
  );
  k.on("turnEnd", "lightCone", ownTurn, (ctx) =>
    ctx.setCounter(ctx.self, OWN_TURN, 0)
  );
  k.on(
    "hpChanged",
    "lightCone",
    {
      subject: "selfOrMemosprite",
      when: (event, self) =>
        self.counter(OWN_TURN) > 0.5 && (event.delta ?? 0) < 0,
    },
    (ctx) => {
      ctx.applyStatus(ctx.self, deathFlower);
      sync(ctx);
    }
  );

  // The advance triggers once until the wearer's next Ultimate.
  const SPENT = "lc23040:spent";
  k.on(
    "departed",
    "lightCone",
    {
      subject: "memosprite",
      when: (_event, self) => self.counter(SPENT) < 0.5,
    },
    (ctx) => {
      ctx.setCounter(ctx.self, SPENT, 1);
      ctx.advanceAction(ctx.self, k.s(4));
    }
  );
  k.on("actionStart", "lightCone", { abilityKinds: ["ultimate"] }, (ctx) =>
    ctx.setCounter(ctx.self, SPENT, 0)
  );
});
