import { defineRelicSet } from "../../kit/equipment";

const TRIGGERED = "diviner-elation-triggered";

/** Diviner of Distant Reach. SPD is applied from catalog properties. */
export default defineRelicSet("130", {
  fourPiece: (k) => {
    // "Before entering combat": `applier` reads the wearer's steady panel,
    // so in-battle SPD buffs do not change the tier. The second tier adds
    // the difference.
    const tiers = [
      { atLeast: k.param(1), critRate: k.param(3) },
      { atLeast: k.param(2), critRate: k.param(4) - k.param(3) },
    ];
    for (const tier of tiers) {
      k.stat("relic4pc", {
        stat: "critRate",
        scaling: {
          source: "applier",
          stat: "spd",
          atLeast: tier.atLeast,
          ratio: tier.critRate,
        },
      });
    }

    const elation = k.status({
      id: "diviner-elation",
      origin: "relic4pc",
      modifiers: [{ stat: "elation", value: k.param(5) }],
      unique: true,
    });
    k.on(
      "actionStart",
      "relic4pc",
      {
        abilityKinds: ["elationSkill"],
        when: (_event, self) => self.counter(TRIGGERED) <= 0,
      },
      (ctx) => {
        ctx.setCounter(ctx.self, TRIGGERED, 1);
        for (const ally of ctx.allies) ctx.applyStatus(ally, elation);
      }
    );
    // Lasts for the battle: memosprites summoned later receive it when they act.
    k.on(
      "actionStart",
      "relic4pc",
      {
        subject: "ally",
        when: (event, self) =>
          self.counter(TRIGGERED) > 0 &&
          event.unit.kind !== "summon" &&
          !event.unit.has(elation),
      },
      (ctx, event) => ctx.applyStatus(event.unit, elation)
    );
  },
});
