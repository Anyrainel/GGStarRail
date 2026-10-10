import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** Trailblazer — Elation, Lightning. */
export default defineCharacter("8009", (k) => {
  const PUNCHLINE = "punchline";
  /** A6's mark from an ally Elation Skill (probability it is held). */
  const A6_MARK = "a6-mark";

  // The Ultimate's ally: by default the first Elation teammate, else the
  // first damage dealer, else a Nihility teammate, else the first teammate.
  // "Has an Elation Skill" is read as the Elation Path.
  const damagePaths = ["Mage", "Warrior", "Rogue", "Memory"];
  const designated = k.ally(
    "ultimate-target",
    "ultimate",
    (candidates) => {
      const others = candidates.filter((member) => member.characterId !== k.id);
      return (
        others.find((member) => member.pathId === "Elation") ??
        others.find((member) => damagePaths.includes(member.pathId)) ??
        others.find((member) => member.pathId === "Warlock") ??
        others[0]
      );
    },
    { includeSelf: true }
  );
  const designatedAlly = (view: {
    self: UnitView;
    allies: readonly UnitView[];
  }): UnitView =>
    view.allies.find(
      (ally) => ally.kind === "character" && ally.slot === designated?.slot
    ) ?? view.self;

  if (k.a(1)) {
    k.stat("a2", {
      stat: "elation",
      scaling: {
        source: "holder",
        stat: "atk",
        threshold: k.traceParam(1, 1),
        step: k.traceParam(1, 2),
        ratio: k.traceParam(1, 3),
        cap: k.traceParam(1, 4),
      },
    });
  }
  if (k.a(2)) k.stat("a4", { stat: "critRate", value: k.traceParam(2, 1) });

  const ultimateCritDmg = k.status({
    id: "starward-crit-dmg",
    origin: "ultimate",
    duration: { turns: k.param("03", 2) },
    modifiers: [{ stat: "critDmg", value: k.param("03", 1) }],
  });
  const e1Bonus = k.status({
    id: "e1-banger-bonus",
    origin: "e1",
    maxStacks: k.rankParam(1, 2),
  });
  const e2Elation = k.status({
    id: "e2-elation",
    origin: "e2",
    duration: { turns: k.rankParam(2, 2) },
    modifiers: [{ stat: "elation", value: k.rankParam(2, 1) }],
  });
  const e4Vulnerability = k.status({
    id: "e4-dmg-taken",
    origin: "e4",
    debuff: true,
    duration: { turns: k.rankParam(4, 2) },
    modifiers: [{ stat: "vulnerability", value: k.rankParam(4, 1) }],
  });
  const e6CritDmg = k.status({
    id: "e6-crit-dmg",
    origin: "e6",
    duration: { turns: k.rankParam(6, 2) },
    modifiers: [{ stat: "critDmg", value: k.rankParam(6, 1) }],
  });

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    // A6's mark is spent for its Certified Banger before the DMG, so it
    // counts for the Talent's check below.
    before: (ctx) => {
      const mark = ctx.self.counter(A6_MARK);
      if (mark > 1e-9) {
        ctx.grantCertifiedBanger(ctx.self, k.traceParam(3, 1) * mark);
        ctx.setCounter(ctx.self, A6_MARK, 0);
      }
    },
    hits: (ctx) => {
      const hits: HitDef[] = [
        { shape: "aoe", each: k.param("02", 1), toughness: { each: 20 } },
      ];
      // Checked before this Skill's own Certified Banger, which comes after
      // the DMG; it uses the highest Certified Banger of allies.
      if (ctx.self.certifiedBanger() > 0) {
        const punchline = Math.max(
          ...ctx.allies.map((ally) => ally.certifiedBanger())
        );
        hits.push({
          shape: "aoe",
          each: k.param("04", 3),
          kind: "elation",
          punchline,
        });
      }
      return hits;
    },
    after: (ctx) => {
      ctx.grantCertifiedBanger(ctx.self, k.param("02", 2));
      if (k.e(1)) ctx.applyStatus(ctx.self, e1Bonus);
    },
  });

  const elationHits = (punchline?: number): HitDef[] => {
    const fixed = punchline === undefined ? {} : { punchline };
    return [
      {
        shape: "bounce",
        each: k.param("20", 2),
        bounces: k.param("20", 1),
        kind: "elation",
        ...fixed,
      },
      // Facts give the Toughness (20 per enemy) to the AoE part only.
      {
        shape: "split",
        main: k.param("20", 3),
        kind: "elation",
        toughness: { each: 20 },
        ...fixed,
      },
    ];
  };
  const onElationSkill = (ctx: BattleApi) => {
    if (k.e(4)) {
      for (const enemy of ctx.enemies) ctx.applyStatus(enemy, e4Vulnerability);
    }
    if (k.e(6)) ctx.applyStatus(ctx.self, e6CritDmg);
  };

  k.ability({
    id: "elationSkill",
    kind: "elationSkill",
    before: onElationSkill,
    hits: elationHits(),
  });

  // The Ultimate's Elation Skill when the Trailblazer designates themself.
  k.ability({
    id: "ultimateElationSkill",
    kind: "elationSkill",
    before: onElationSkill,
    hits: elationHits(k.param("03", 5)),
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "ally",
    before: (ctx) => {
      ctx.addTeamResource(PUNCHLINE, k.param("03", 6));
      const target =
        ctx.target && !isEnemy(ctx.target) && ctx.target.kind === "character"
          ? ctx.target
          : designatedAlly(ctx);
      ctx.applyStatus(target, ultimateCritDmg);
      if (k.e(2)) ctx.applyStatus(target, e2Elation);
      // Elation Characters are the ones with an Elation Skill.
      if (target.pathId === "Elation") {
        const bonus = k.e(1) ? ctx.self.stacks(e1Bonus) * k.rankParam(1, 1) : 0;
        ctx.grantCertifiedBanger(target, k.param("03", 4) + bonus);
        // Another Character's Elation Skill takes the current Punchline
        // instead of the fixed amount (tracked: trailblazer-elation-ult-punchline).
        if (target === ctx.self) {
          ctx.queueAction(ctx.self, "ultimateElationSkill");
        } else {
          ctx.queueAction(target, "elationSkill");
        }
      } else {
        ctx.advanceAction(target, k.param("03", 3));
      }
      if (k.e(1)) ctx.removeStatus(ctx.self, e1Bonus);
    },
    after: (ctx) => {
      if (k.a(2)) ctx.gainSkillPoints(k.traceParam(2, 2));
    },
  });

  k.on("actionEnd", "talent", { attack: true }, (ctx) => {
    ctx.gainEnergy(ctx.self, k.param("04", 1), { fixed: true });
    ctx.addTeamResource(PUNCHLINE, k.param("04", 2));
  });

  if (k.a(3)) {
    // One mark, however many Elation Skills precede the Skill.
    k.on(
      "actionEnd",
      "a6",
      { subject: "ally", abilityKinds: ["elationSkill"] },
      (ctx) => ctx.addCounter(ctx.self, A6_MARK, 1, 1)
    );
  }

  k.policy({
    ultimate: (view) => ({
      ability: "ultimate",
      target: designatedAlly(view),
    }),
  });
});
