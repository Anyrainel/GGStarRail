import { isEnemy } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";
import type { StatusDef } from "../../kit/model";

const SPENT = "master-smith-spent";

function reducesDef(status: StatusDef | undefined): status is StatusDef {
  return (
    status?.modifiers?.some((modifier) => modifier.stat === "defReduction") ??
    false
  );
}

/** Divine-Querying Master Smith. Max HP is applied from catalog properties. */
export default defineRelicSet("132", {
  fourPiece: (k) => {
    // There is no "DEF reduced" target filter (see tracker): a marker on each
    // enemy mirrors whether it holds any status with a DEF reduction.
    const defReduced = k.status({
      id: "master-smith-def-reduced",
      origin: "relic4pc",
    });
    const reducers = new Set<StatusDef>();
    k.stat("relic4pc", {
      stat: "critDmg",
      value: k.param(1),
      filter: { targetStatuses: [defReduced.id] },
    });
    k.on(
      "statusApplied",
      "relic4pc",
      {
        subject: "any",
        when: (event) => reducesDef(event.status) && isEnemy(event.target),
      },
      (ctx, event) => {
        if (!reducesDef(event.status) || !event.target) return;
        reducers.add(event.status);
        ctx.applyStatus(event.target, defReduced);
      }
    );
    // DEF reductions expire or are removed without an event: resync before
    // every action.
    k.on("actionStart", "relic4pc", { subject: "any" }, (ctx) => {
      for (const enemy of ctx.enemies) {
        const reduced = [...reducers].some((status) => enemy.has(status));
        if (reduced && !enemy.has(defReduced)) {
          ctx.applyStatus(enemy, defReduced);
        } else if (!reduced && enemy.has(defReduced)) {
          ctx.removeStatus(enemy, defReduced);
        }
      }
    });

    const comburent = k.status({
      id: "comburent",
      origin: "relic4pc",
      duration: { turns: k.param(2) },
      modifiers: [{ stat: "dmgBoost", value: k.param(3) }],
      unique: true,
    });
    k.on(
      "statusApplied",
      "relic4pc",
      {
        when: (event, self) =>
          reducesDef(event.status) &&
          isEnemy(event.target) &&
          self.counter(SPENT) <= 0,
      },
      (ctx) => {
        ctx.setCounter(ctx.self, SPENT, 1);
        for (const ally of ctx.allies) ctx.applyStatus(ally, comburent);
      }
    );
    k.on("actionEnd", "relic4pc", { attack: true }, (ctx) =>
      ctx.setCounter(ctx.self, SPENT, 0)
    );
  },
});
