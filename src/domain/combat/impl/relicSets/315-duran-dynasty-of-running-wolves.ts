import { defineRelicSet } from "../../kit/equipment";

/** Duran, Dynasty of Running Wolves. */
export default defineRelicSet("315", {
  twoPiece: (k) => {
    const maxStacks = k.param(1);
    const merit = k.status({
      id: "merit",
      origin: "ornament",
      maxStacks,
      modifiers: [
        { stat: "dmgBoost", value: k.param(2), filter: { tags: ["followUp"] } },
      ],
    });
    // Merit never expires, so the full-stack bonus stays once reached.
    const fullMerit = k.status({
      id: "merit-full",
      origin: "ornament",
      modifiers: [{ stat: "critDmg", value: k.param(3) }],
    });
    // "Ally characters": memosprites do not count; summons acting for their
    // owner (Numby, Lightning-Lord) do.
    k.on(
      "actionStart",
      "ornament",
      {
        subject: "ally",
        abilityKinds: ["followUp"],
        when: (event) => event.unit.kind !== "memosprite",
      },
      (ctx) => {
        ctx.applyStatus(ctx.self, merit, { stacks: ctx.weight });
        if (ctx.self.stacks(merit) + 1e-9 >= maxStacks) {
          ctx.applyStatus(ctx.self, fullMerit);
        }
      }
    );
  },
});
