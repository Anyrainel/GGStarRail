import { defineCharacter } from "../../kit/character";
import type { ModifierDef, TurnDuration } from "../../kit/model";
import type { DamageTag } from "../../model/tags";

const ATTACK_TAGS: readonly DamageTag[] = [
  "basic",
  "skill",
  "ultimate",
  "followUp",
  "memosprite",
  "elation",
];

/** Tribbie — Harmony, Quantum. */
export default defineCharacter("1403", (k) => {
  const numinosityModifiers: ModifierDef[] = [
    { stat: "resPen", value: k.param("02", 1) },
  ];
  if (k.e(4)) {
    numinosityModifiers.push({ stat: "defIgnore", value: k.rankParam(4, 1) });
  }
  // Every ally holds it while Tribbie has Numinosity: it counts down at the
  // start of Tribbie's turns.
  const numinosity = k.status({
    id: "numinosity",
    origin: "skill",
    duration: {
      turns: k.param("02", 2),
      countdown: "turnStart",
      clock: "applier",
    },
    modifiers: numinosityModifiers,
  });

  const zoneDuration: TurnDuration = {
    turns: k.param("03", 4),
    countdown: "turnStart",
    clock: "applier",
  };
  const zone = k.status({
    id: "zone",
    origin: "ultimate",
    duration: zoneDuration,
  });
  // A Zone effect rather than a debuff.
  const zoneVulnerability = k.status({
    id: "zone-vulnerability",
    origin: "ultimate",
    duration: zoneDuration,
    modifiers: [{ stat: "vulnerability", value: k.param("03", 2) }],
  });
  // E1 "True DMG equal to 24% of the total DMG of this attack": every attack
  // hit carries it, so the total matches whichever target receives it.
  const sugarScoop = k.status({
    id: "rite-of-sugar-scoop",
    origin: "e1",
    duration: zoneDuration,
    modifiers: [
      {
        stat: "trueDmg",
        value: k.rankParam(1, 1),
        filter: { tags: ATTACK_TAGS },
      },
    ],
  });
  // A4: stacks hold the sum of the ally Characters' Max HP (steady panels,
  // synced when the Zone opens); no scaling source reads other allies.
  const glassBall = k.status({
    id: "glass-ball-with-wings",
    origin: "a4",
    duration: zoneDuration,
    maxStacks: Number.POSITIVE_INFINITY,
    modifiers: [{ stat: "hpFlat", value: k.traceParam(2, 1) }],
  });
  const lamb = k.status({
    id: "lamb-outside-the-wall",
    origin: "a2",
    duration: { turns: k.traceParam(1, 3) },
    maxStacks: k.traceParam(1, 2),
    modifiers: [{ stat: "dmgBoost", value: k.traceParam(1, 1) }],
  });

  // The Zone's Additional DMG is Tribbie's only Additional DMG.
  if (k.e(2)) {
    k.stat("e2", {
      stat: "dmgMultiplier",
      value: k.rankParam(2, 1) - 1,
      filter: { tags: ["additional"] },
    });
  }
  if (k.e(6)) {
    k.stat("e6", {
      stat: "dmgBoost",
      value: k.rankParam(6, 1),
      filter: { tags: ["followUp"] },
    });
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      {
        shape: "blast",
        main: k.param("01", 1),
        adjacent: k.param("01", 2),
        stat: "hp",
        toughness: { main: 10, adjacent: 5 },
      },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "allies",
    before: (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, numinosity);
    },
  });

  const busy = (unitId: string) => `busy:${unitId}`;

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [
      {
        shape: "aoe",
        each: k.param("03", 1),
        stat: "hp",
        toughness: { each: 20 },
      },
    ],
    before: (ctx) => {
      ctx.applyStatus(ctx.self, zone);
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, zoneVulnerability);
      }
      if (k.e(1)) {
        for (const ally of ctx.allies) ctx.applyStatus(ally, sugarScoop);
      }
      if (k.a(2)) {
        let total = 0;
        for (const ally of ctx.allies) {
          if (ally.kind === "character") total += ally.panelStat("hp");
        }
        ctx.applyStatus(ctx.self, glassBall, { setStacks: total });
      }
      for (const ally of ctx.allies) ctx.setCounter(ctx.self, busy(ally.id), 0);
    },
    after: (ctx) => {
      if (k.e(6)) ctx.queueAction(ctx.self, "followUp");
    },
  });

  k.ability({
    id: "followUp",
    kind: "followUp",
    energy: 5,
    hits: [
      {
        shape: "aoe",
        each: k.param("04", 1),
        stat: "hp",
        toughness: { each: 5 },
      },
    ],
    after: (ctx) => {
      if (k.a(1)) ctx.applyStatus(ctx.self, lamb);
    },
  });

  k.on(
    "actionEnd",
    "talent",
    {
      subject: "otherAlly",
      abilityKinds: ["ultimate"],
      when: (event, self) =>
        event.unit.kind === "character" &&
        self.counter(busy(event.unit.id)) < 1,
    },
    (ctx, event) => {
      ctx.setCounter(ctx.self, busy(event.unit.id), 1);
      ctx.queueAction(ctx.self, "followUp");
    }
  );

  // HP is not simulated: the main target (the boss) stands for the hit
  // target with the highest HP whenever it was hit.
  k.on(
    "actionEnd",
    "ultimate",
    { subject: "ally", attack: true, when: (_event, self) => self.has(zone) },
    (ctx, event) => {
      const hit = event.targetsHit ?? [];
      const main = ctx.mainTarget;
      const target = main && hit.includes(main) ? main : hit[0];
      if (!target) return;
      const instances = hit.length * (k.e(2) ? 1 + k.rankParam(2, 2) : 1);
      for (let index = 0; index < instances; index += 1) {
        ctx.deal(
          {
            shape: "single",
            main: k.param("03", 3),
            stat: "hp",
            onlyTags: ["additional"],
          },
          {
            targets: [target],
            abilityId: "zone-additional",
            origin: "ultimate",
          }
        );
      }
    }
  );

  if (k.a(3)) {
    k.on("battleStart", "a6", { subject: "any" }, (ctx) =>
      ctx.gainEnergy(ctx.self, k.traceParam(3, 1))
    );
    k.on(
      "actionEnd",
      "a6",
      { subject: "otherAlly", attack: true },
      (ctx, event) =>
        ctx.gainEnergy(
          ctx.self,
          k.traceParam(3, 2) * (event.targetsHit?.length ?? 0)
        )
    );
  }

  k.policy({
    // Skill only to (re)apply Numinosity; Basic ATK while it lasts.
    turn: (view) =>
      !view.self.has(numinosity) && view.skillPoints >= 1 ? "skill" : "basic",
  });
});
