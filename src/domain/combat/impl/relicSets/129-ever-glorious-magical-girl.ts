import type { BattleApi } from "../../kit/api";
import { defineRelicSet } from "../../kit/equipment";

const PUNCHLINE_GAINED = "magical-girl-punchline";

/** Ever-Glorious Magical Girl. CRIT DMG is applied from catalog properties. */
export default defineRelicSet("129", {
  fourPiece: (k) => {
    // Memosprites inherit the wearer's permanent modifiers.
    k.stat("relic4pc", {
      stat: "defIgnore",
      value: k.param(1),
      filter: { tags: ["elation"] },
    });
    const accumulated = k.status({
      id: "magical-girl-def-ignore",
      origin: "relic4pc",
      maxStacks: k.param(4),
      modifiers: [
        { stat: "defIgnore", value: k.param(3), filter: { tags: ["elation"] } },
      ],
    });
    // Memosprites do not inherit statuses: the stacks go to each of them.
    const sync = (ctx: BattleApi) => {
      const stacks = Math.min(
        k.param(4),
        Math.floor(ctx.self.counter(PUNCHLINE_GAINED) / k.param(2) + 1e-9)
      );
      if (stacks <= 0) return;
      const units = ctx.allies.filter(
        (unit) =>
          unit.id === ctx.self.id ||
          (unit.kind === "memosprite" && unit.owner?.id === ctx.self.id)
      );
      for (const unit of units) {
        if (unit.stacks(accumulated) !== stacks) {
          ctx.applyStatus(unit, accumulated, { setStacks: stacks });
        }
      }
    };
    k.on(
      "teamResourceChanged",
      "relic4pc",
      {
        subject: "any",
        resource: "punchline",
        when: (event) => (event.delta ?? 0) > 0,
      },
      (ctx, event) => {
        // `delta` is already weighted.
        ctx.setCounter(
          ctx.self,
          PUNCHLINE_GAINED,
          ctx.self.counter(PUNCHLINE_GAINED) + (event.delta ?? 0)
        );
        sync(ctx);
      }
    );
    k.on("actionStart", "relic4pc", { subject: "memosprite" }, sync);
  },
});
