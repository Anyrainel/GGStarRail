import { isEnemy } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";
import type { StatusDef } from "../../kit/model";

const SPENT = "master-smith-spent";

/** A status that lowers its holder's DEF (the engine's `defReduced` family). */
function reducesDef(status: StatusDef | undefined): boolean {
  return (
    status?.modifiers?.some(
      (modifier) =>
        modifier.stat === "defReduction" &&
        ((modifier.value ?? 0) > 0 || modifier.scaling !== undefined)
    ) ?? false
  );
}

/** Divine-Querying Master Smith. Max HP is applied from catalog properties. */
export default defineRelicSet("132", {
  fourPiece: (k) => {
    k.stat("relic4pc", {
      stat: "critDmg",
      value: k.param(1),
      filter: { targetFamilies: ["defReduced"] },
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
