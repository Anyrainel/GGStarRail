import { isEnemy } from "../../kit/api";
import { defineLightCone } from "../../kit/equipment";

/**
 * Long May Rainbows Adorn the Sky — Remembrance. SPD is applied from catalog
 * properties.
 */
export default defineLightCone("23042", (k) => {
  // Consumed HP in units of the wearer's panel Max HP, so the memosprite's
  // hit can scale off its owner's Max HP. "All allies" includes memosprites.
  const CONSUMED = "lc23042:consumed";
  k.on(
    "actionStart",
    "lightCone",
    { abilityKinds: ["basic", "skill", "ultimate"] },
    (ctx) => {
      const wearerHp = ctx.self.panelStat("hp");
      if (wearerHp <= 0) return;
      let total = 0;
      for (const ally of ctx.allies) {
        const consumed = ctx.consumeHp(ally, k.s(2) * ally.hpRatio);
        total += consumed * ally.currentStat("hp");
      }
      // consumeHp already returns the expected (weighted) amount.
      ctx.setCounter(
        ctx.self,
        CONSUMED,
        ctx.self.counter(CONSUMED) + total / wearerHp
      );
    }
  );
  // "The attacked target": the designated target of the memosprite's
  // attack (tracker long-may-rainbows-adorn-the-sky-target).
  k.on(
    "actionEnd",
    "lightCone",
    {
      subject: "memosprite",
      attack: true,
      when: (_event, self) => self.counter(CONSUMED) > 1e-9,
    },
    (ctx, event) => {
      const target = isEnemy(event.target)
        ? event.target
        : event.targetsHit?.[0];
      if (!target) return;
      const consumed = ctx.self.counter(CONSUMED);
      ctx.setCounter(ctx.self, CONSUMED, 0);
      ctx.deal(
        {
          shape: "single",
          main: k.s(6) * consumed,
          stat: "hp",
          statOwner: "owner",
          onlyTags: ["additional", "memosprite"],
        },
        { attacker: event.unit, targets: [target], abilityId: "rainbows" }
      );
    }
  );

  const tolerant = k.status({
    id: "long-may-rainbows-adorn-the-sky-vulnerability",
    origin: "lightCone",
    debuff: true,
    unique: true,
    duration: { turns: k.s(5) },
    modifiers: [{ stat: "vulnerability", value: k.s(4) }],
  });
  k.on(
    "actionStart",
    "lightCone",
    { subject: "memosprite", abilityKinds: ["memospriteSkill"] },
    (ctx) => {
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, tolerant);
    }
  );
});
