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

  // "On themselves" (对自身单体): an Ultimate aimed at the wearer, declared
  // as such or aimed at one ally that is the wearer.
  k.on(
    "actionStart",
    "lightCone",
    {
      abilityKinds: ["ultimate"],
      when: (event, self) =>
        self.counter(SPENT) <= 0.5 &&
        (event.abilityTarget === "self" ||
          (event.abilityTarget === "ally" && event.target === self)),
    },
    (ctx) => {
      ctx.addTeamResource("punchline", k.s(3));
      ctx.setCounter(ctx.self, SPENT, 1);
      ctx.setCounter(ctx.self, BASICS, 0);
    }
  );
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
