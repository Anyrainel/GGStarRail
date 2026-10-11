import { defineLightCone } from "../../kit/equipment";

/** Shadowburn — Remembrance. */
export default defineLightCone("20021", (k) => {
  const SUMMONED = "lc20021:summoned";
  k.on(
    "summoned",
    "lightCone",
    {
      subject: "memosprite",
      when: (_event, self) => self.counter(SUMMONED) === 0,
    },
    (ctx) => {
      ctx.setCounter(ctx.self, SUMMONED, 1);
      ctx.gainSkillPoints(k.s(1));
      ctx.gainEnergy(ctx.self, k.s(2));
    }
  );
});
