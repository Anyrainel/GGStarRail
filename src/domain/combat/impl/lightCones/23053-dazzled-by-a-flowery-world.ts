import { defineLightCone } from "../../kit/equipment";

/**
 * Dazzled by a Flowery World — Elation. CRIT DMG is applied from catalog
 * properties.
 */
export default defineLightCone("23053", (k) => {
  // "Cannot stack": a second wearer only adds what exceeds the Skill Point
  // limit already granted (tracked on the first ally).
  const LIMIT = "dazzled-by-a-flowery-world-sp-limit";
  const increase = Math.min(k.s(3), k.countPath("Elation") * k.s(2));
  k.on("battleStart", "lightCone", { subject: "any" }, (ctx) => {
    const ledger = ctx.allies[0];
    if (!ledger) return;
    const extra = increase - ledger.counter(LIMIT);
    if (extra <= 0) return;
    ctx.setCounter(ledger, LIMIT, increase);
    ctx.setMaxSkillPoints(ctx.maxSkillPoints + extra);
  });

  // Neither the DEF ignore stacks nor Stream Promo has a duration in the
  // text: both last for the battle once gained.
  const defIgnore = k.status({
    id: "dazzled-by-a-flowery-world-def-ignore",
    origin: "lightCone",
    maxStacks: k.s(5),
    modifiers: [
      { stat: "defIgnore", value: k.s(6), filter: { tags: ["elation"] } },
    ],
  });
  const streamPromo = k.status({
    id: "dazzled-by-a-flowery-world-stream-promo",
    origin: "lightCone",
    unique: true,
    modifiers: [{ stat: "elation", value: k.s(4) }],
  });

  // Skill Points consumed in the current turn (expected value).
  const SPENT = "dazzled-by-a-flowery-world-spent";
  k.on("turnStart", "lightCone", { subject: "any" }, (ctx) =>
    ctx.setCounter(ctx.self, SPENT, 0)
  );
  k.on(
    "skillPointsChanged",
    "lightCone",
    { when: (event) => (event.delta ?? 0) < 0 },
    (ctx, event) => {
      const consumed = -(event.delta ?? 0);
      ctx.applyStatus(ctx.self, defIgnore, { stacks: consumed });
      ctx.addCounter(ctx.self, SPENT, consumed);
      if (
        ctx.self.counter(SPENT) + 1e-9 >= k.s(7) &&
        !ctx.self.has(streamPromo)
      ) {
        for (const ally of ctx.allies) ctx.applyStatus(ally, streamPromo);
      }
    }
  );
});
