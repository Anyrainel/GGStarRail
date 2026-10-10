import type { BattleApi } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Sleep Like the Dead — The Hunt. CRIT DMG is applied from catalog
 * properties.
 *
 * CRIT is an expected value, so the trigger is too: an action triggers with
 * the chance that at least one of its Basic ATK/Skill DMG instances does not
 * CRIT, read from the wearer's steady CRIT Rate. Triggers within one
 * cooldown window exclude each other, so the chance still available is one
 * minus the triggers of the last `cooldown` own turns, and the buff carries
 * the triggers whose duration has not run out.
 */
export default defineLightCone("23012", (k) => {
  const duration = k.s(3);
  const cooldown = k.s(4);
  const sweetDreams = k.status({
    id: "sweet-dreams",
    origin: "lightCone",
    modifiers: [{ stat: "critRate", value: k.s(2) }],
  });

  // history(i): trigger chance i own turns ago (0 = the current turn).
  const turns = Math.max(cooldown, duration);
  const historyKey = (i: number) => `sleep-like-the-dead:${i}`;
  const allCritKey = "sleep-like-the-dead:all-crit";
  const recent = (ctx: BattleApi, count: number) => {
    let total = 0;
    for (let i = 0; i < count; i += 1) total += ctx.self.counter(historyKey(i));
    return total;
  };
  const setBuff = (ctx: BattleApi, stacks: number) => {
    if (stacks <= 1e-9) ctx.removeStatus(ctx.self, sweetDreams);
    else if (ctx.self.has(sweetDreams))
      ctx.setStatusStacks(ctx.self, sweetDreams, stacks);
    else ctx.applyStatus(ctx.self, sweetDreams, { setStacks: stacks });
  };

  k.on("turnStart", "lightCone", {}, (ctx) => {
    for (let i = turns - 1; i > 0; i -= 1) {
      ctx.setCounter(
        ctx.self,
        historyKey(i),
        ctx.self.counter(historyKey(i - 1))
      );
    }
    ctx.setCounter(ctx.self, historyKey(0), 0);
  });
  k.on("actionStart", "lightCone", {}, (ctx) =>
    ctx.setCounter(ctx.self, allCritKey, 1)
  );
  k.on("hit", "lightCone", { tags: ["basic", "skill"] }, (ctx) => {
    const critRate = Math.min(1, Math.max(0, ctx.self.panelStat("critRate")));
    ctx.setCounter(
      ctx.self,
      allCritKey,
      ctx.self.counter(allCritKey) * critRate
    );
  });
  k.on(
    "actionEnd",
    "lightCone",
    { abilityKinds: ["basic", "skill"], attack: true },
    (ctx) => {
      const ready = Math.max(0, 1 - recent(ctx, cooldown));
      const chance = 1 - ctx.self.counter(allCritKey);
      const trigger = ready * chance * ctx.weight;
      if (trigger <= 1e-9) return;
      ctx.setCounter(
        ctx.self,
        historyKey(0),
        ctx.self.counter(historyKey(0)) + trigger
      );
      setBuff(ctx, ctx.self.stacks(sweetDreams) + trigger);
    }
  );
  // At the wearer's turn end, triggers older than `duration` own turns expire.
  k.on("turnEnd", "lightCone", {}, (ctx) =>
    setBuff(ctx, recent(ctx, duration))
  );
});
