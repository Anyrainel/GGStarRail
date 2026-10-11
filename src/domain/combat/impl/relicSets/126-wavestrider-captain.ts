import { defineRelicSet } from "../../kit/equipment";

/** Wavestrider Captain. CRIT DMG is applied from catalog properties. */
export default defineRelicSet("126", {
  fourPiece: (k) => {
    const help = k.status({
      id: "wavestrider-help",
      origin: "relic4pc",
      maxStacks: k.param(1),
    });
    const atk = k.status({
      id: "wavestrider-atk",
      origin: "relic4pc",
      duration: { turns: k.param(3) },
      modifiers: [{ stat: "atkPct", value: k.param(2) }],
    });
    // Another ally's ability aimed at the wearer, or at all allies (the
    // wearer is one of its targets; unconfirmed in game).
    k.on(
      "actionStart",
      "relic4pc",
      {
        subject: "otherAlly",
        when: (event, self) =>
          (event.abilityTarget === "ally" && event.target?.id === self.id) ||
          event.abilityTarget === "allies",
      },
      (ctx) => ctx.applyStatus(ctx.self, help, { stacks: ctx.weight })
    );
    k.on(
      "actionStart",
      "relic4pc",
      {
        abilityKinds: ["ultimate"],
        when: (_event, self) => self.stacks(help) >= k.param(1) - 1e-9,
      },
      (ctx) => {
        ctx.removeStatus(ctx.self, help);
        ctx.applyStatus(ctx.self, atk);
      }
    );
  },
});
