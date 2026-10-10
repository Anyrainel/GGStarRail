import { isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

/** Ruan Mei — Harmony, Ice. */
export default defineCharacter("1303", (k) => {
  const overtoneModifiers: ModifierDef[] = [
    { stat: "dmgBoost", value: k.param("02", 1) },
    { stat: "breakEfficiency", value: k.param("02", 2) },
  ];
  if (k.a(3)) {
    overtoneModifiers.push({
      stat: "dmgBoost",
      scaling: {
        source: "applier",
        stat: "breakEffect",
        ratio: k.traceParam(3, 3),
        threshold: k.traceParam(3, 1),
        step: k.traceParam(3, 2),
        cap: k.traceParam(3, 4),
      },
    });
  }
  const overtone = k.status({
    id: "overtone",
    origin: "skill",
    // "This duration decreases by 1 at the start of Ruan Mei's every turn."
    duration: {
      turns: k.param("02", 3),
      countdown: "turnStart",
      clock: "applier",
    },
    modifiers: overtoneModifiers,
  });

  const zoneModifiers: ModifierDef[] = [
    { stat: "resPen", value: k.param("03", 1) },
  ];
  if (k.e(1))
    zoneModifiers.push({ stat: "defIgnore", value: k.rankParam(1, 1) });
  const zone = k.status({
    id: "petals-to-stream",
    origin: "ultimate",
    // "The Zone's duration decreases by 1 at the start of her turn."
    duration: {
      turns: k.param("03", 2) + (k.e(6) ? k.rankParam(6, 1) : 0),
      countdown: "turnStart",
      clock: "applier",
    },
    modifiers: zoneModifiers,
  });
  const rebloom = k.status({ id: "thanatoplum-rebloom", origin: "ultimate" });

  k.teamStat(
    "talent",
    { stat: "spdPct", value: k.param("04", 1) },
    "otherAllies"
  );
  if (k.a(1)) {
    k.teamStat("a2", { stat: "breakEffect", value: k.traceParam(1, 1) });
  }
  if (k.e(2)) {
    k.teamStat("e2", {
      stat: "atkPct",
      value: k.rankParam(2, 1),
      filter: { targetBroken: true },
    });
  }

  if (k.a(2)) {
    k.on("turnStart", "a4", {}, (ctx) =>
      ctx.gainEnergy(ctx.self, k.traceParam(2, 1))
    );
  }

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
    target: "allies",
    before: (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, overtone);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "allies",
    before: (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, zone);
    },
  });

  k.on(
    "actionEnd",
    "ultimate",
    { subject: "ally", attack: true, when: (_, self) => self.has(zone) },
    (ctx, event) => {
      for (const enemy of event.targetsHit ?? []) {
        if (!enemy.has(rebloom)) ctx.applyStatus(enemy, rebloom);
      }
    }
  );

  // Rebloom triggers when a Broken enemy's turn starts. The engine still
  // recovers the enemy on this turn instead of extending the Weakness Break,
  // so the delay pushes back its next turn.
  k.on(
    "turnStart",
    "ultimate",
    {
      subject: "enemy",
      when: (event) =>
        isEnemy(event.unit) && event.unit.broken && event.unit.has(rebloom),
    },
    (ctx, event) => {
      const enemy = event.unit;
      if (!isEnemy(enemy)) return;
      ctx.removeStatus(enemy, rebloom);
      ctx.deal(
        {
          shape: "single",
          main: k.param("03", 5),
          kind: "break",
          combatType: "Ice",
          onlyTags: ["break"],
        },
        {
          targets: [enemy],
          origin: "ultimate",
          abilityId: "thanatoplumRebloom",
        }
      );
      ctx.delayAction(
        enemy,
        k.param("03", 3) * ctx.self.panelStat("breakEffect") + k.param("03", 4)
      );
    }
  );

  const talentBreak = k.param("04", 2) + (k.e(6) ? k.rankParam(6, 2) : 0);
  k.on("weaknessBreak", "talent", { subject: "ally" }, (ctx, event) => {
    if (!isEnemy(event.target)) return;
    ctx.deal(
      {
        shape: "single",
        main: talentBreak,
        kind: "break",
        combatType: "Ice",
        onlyTags: ["break"],
      },
      { targets: [event.target], origin: "talent", abilityId: "talentBreak" }
    );
  });

  if (k.e(4)) {
    const chatoyant = k.status({
      id: "chatoyant-eclat",
      origin: "e4",
      duration: { turns: k.rankParam(4, 2) },
      modifiers: [{ stat: "breakEffect", value: k.rankParam(4, 1) }],
    });
    k.on("weaknessBreak", "e4", { subject: "ally" }, (ctx) =>
      ctx.applyStatus(ctx.self, chatoyant)
    );
  }

  k.policy({
    // Skill only to (re)apply Overtone; Basic ATK otherwise.
    turn: (view) =>
      !view.self.has(overtone) && view.skillPoints >= 1 ? "skill" : "basic",
  });
});
