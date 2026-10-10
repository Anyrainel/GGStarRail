import { defineLightCone } from "../../kit/equipment";

/** The Moles Welcome You — Destruction. */
export default defineLightCone("21005", (k) => {
  // EN reads as one stack per attack; ZH "分别获取一层" grants one stack for
  // each of Basic ATK, Skill, and Ultimate (ZH followed), so at most 3, and
  // they last for the battle.
  const kinds = ["basic", "skill", "ultimate"] as const;
  const mischievous = k.status({
    id: "mischievous",
    origin: "lightCone",
    maxStacks: kinds.length,
    modifiers: [{ stat: "atkPct", value: k.s(1) }],
  });
  for (const kind of kinds) {
    const counter = `mischievous-${kind}`;
    k.on(
      "actionEnd",
      "lightCone",
      {
        abilityKinds: [kind],
        attack: true,
        when: (_, self) => self.counter(counter) === 0,
      },
      (ctx) => {
        ctx.setCounter(ctx.self, counter, 1);
        ctx.applyStatus(ctx.self, mischievous);
      }
    );
  }
});
