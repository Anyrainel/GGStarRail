import { isEnemy, type UnitView } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Welcome to the Cosmic City — Elation. SPD is applied from catalog
 * properties.
 */
export default defineLightCone("23057", (k) => {
  k.stat("lightCone", {
    stat: "defIgnore",
    value: k.s(2),
    filter: { tags: ["elation"] },
  });

  // 1 while the single trigger is used up; Basic ATKs are counted from then
  // on, and the third one makes it available again.
  const SPENT = "welcome-to-the-cosmic-city-spent";
  const BASICS = "welcome-to-the-cosmic-city-basics";

  // Ultimates carry no target unless the policy names one: an Ultimate is
  // "on themselves" when it does not attack enemies and the statuses the
  // wearer applies during it reach the wearer and no other Character.
  let recipients: Set<UnitView> | null = null;
  const ultimate = { abilityKinds: ["ultimate"] } as const;
  k.on("actionStart", "lightCone", ultimate, () => {
    recipients = new Set();
  });
  k.on("statusApplied", "lightCone", {}, (_ctx, event) => {
    if (recipients && event.target && !isEnemy(event.target)) {
      recipients.add(event.target);
    }
  });
  k.on("actionEnd", "lightCone", ultimate, (ctx, event) => {
    const reached = recipients ? [...recipients] : [];
    recipients = null;
    const onSelf =
      event.target === ctx.self ||
      (!event.attack &&
        reached.includes(ctx.self) &&
        reached.every(
          (unit) => unit === ctx.self || unit.kind !== "character"
        ));
    if (!onSelf || ctx.self.counter(SPENT) > 0.5) return;
    ctx.addTeamResource("punchline", k.s(3));
    ctx.setCounter(ctx.self, SPENT, 1);
    ctx.setCounter(ctx.self, BASICS, 0);
  });
  k.on(
    "actionEnd",
    "lightCone",
    {
      abilityKinds: ["basic"],
      when: (_event, self) => self.counter(SPENT) > 0.5,
    },
    (ctx) => {
      ctx.addCounter(ctx.self, BASICS, 1);
      if (ctx.self.counter(BASICS) + 1e-9 >= k.s(4)) {
        ctx.setCounter(ctx.self, SPENT, 0);
        ctx.setCounter(ctx.self, BASICS, 0);
      }
    }
  );
});
