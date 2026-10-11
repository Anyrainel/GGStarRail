import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { ModifierDef } from "../../kit/model";

const SUPPORT_PATHS = new Set(["Shaman", "Priest", "Knight"]);
const CHARGE = "charge";
const PROCS = "merit-procs";
/** Coup de Main in progress (the Peerage use of the Skill). */
const COUP = "coup-de-main";
/** The original Skill queued after Coup de Main, whose cost was already paid. */
const ORIGINAL = "coup-original";
const A4_USED = "a4-used";

const allyCharacters = (allies: readonly UnitView[]) =>
  allies
    .filter((unit) => unit.kind === "character")
    .sort((left, right) => left.slot - right.slot);

/** The damage dealer: first ally Character in team order not on a support Path. */
function designate(
  self: UnitView,
  allies: readonly UnitView[]
): UnitView | null {
  const others = allyCharacters(allies).filter((unit) => unit !== self);
  return (
    others.find((unit) => !SUPPORT_PATHS.has(unit.pathId)) ?? others[0] ?? null
  );
}

/** Cerydra — Harmony, Wind. */
export default defineCharacter("1412", (k) => {
  const maxCharge = k.param("02", 3);
  const peerageCharge = k.param("02", 4);

  const meritModifiers: ModifierDef[] = [
    {
      stat: "atkFlat",
      scaling: { source: "applier", stat: "atk", ratio: k.param("04", 2) },
    },
  ];
  if (k.e(1)) {
    meritModifiers.push({ stat: "defIgnore", value: k.rankParam(1, 1) });
  }
  if (k.e(2)) {
    meritModifiers.push({ stat: "dmgBoost", value: k.rankParam(2, 1) });
  }
  if (k.e(6)) {
    meritModifiers.push({ stat: "resPen", value: k.rankParam(6, 1) });
  }
  const merit = k.status({
    id: "military-merit",
    origin: "talent",
    modifiers: meritModifiers,
  });

  // EN scopes only the CRIT DMG to Skill DMG; ZH ("造成的战技伤害的暴击伤害、
  // 全属性抗性穿透提高") scopes both, which is followed.
  const peerageModifiers: ModifierDef[] = [
    { stat: "critDmg", value: k.param("02", 1), filter: { tags: ["skill"] } },
    { stat: "resPen", value: k.param("02", 5), filter: { tags: ["skill"] } },
  ];
  if (k.e(1)) {
    peerageModifiers.push({
      stat: "defIgnore",
      value: k.rankParam(1, 2),
      filter: { tags: ["skill"] },
    });
  }
  const peerage = k.status({
    id: "peerage",
    origin: "skill",
    modifiers: peerageModifiers,
  });

  const forgeTheDreams = k.status({
    id: "forge-the-dreams",
    origin: "e2",
    modifiers: [{ stat: "dmgBoost", value: k.rankParam(2, 2) }],
  });
  const journeyStarward = k.status({
    id: "journey-set-starward",
    origin: "e6",
    modifiers: [{ stat: "resPen", value: k.rankParam(6, 1) }],
  });
  const vici = k.status({
    id: "vici",
    origin: "a6",
    duration: { turns: k.traceParam(3, 3) },
    modifiers: [{ stat: "spdFlat", value: k.traceParam(3, 2) }],
  });

  if (k.a(1)) {
    k.stat("a2", {
      stat: "critDmg",
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
  if (k.e(4)) {
    k.stat("e4", {
      stat: "multiplierBoost",
      value: k.rankParam(4, 1),
      filter: { tags: ["ultimate"] },
    });
  }
  // Military Merit's proc is Cerydra's only Additional DMG.
  if (k.e(6)) {
    k.stat("e6", {
      stat: "multiplierBoost",
      value: k.rankParam(6, 2),
      filter: { tags: ["additional"] },
    });
  }

  const holder = (allies: readonly UnitView[]) =>
    allies.find((unit) => unit.has(merit)) ?? null;

  const syncPeerage = (ctx: BattleApi) => {
    const current = holder(ctx.allies);
    if (
      current &&
      !current.has(peerage) &&
      ctx.self.counter(COUP) <= 0 &&
      ctx.self.counter(CHARGE) + 1e-9 >= peerageCharge
    ) {
      ctx.applyStatus(current, peerage);
    }
  };
  const gainCharge = (ctx: BattleApi, amount: number) => {
    if (ctx.self.counter(COUP) > 0) return;
    ctx.addCounter(ctx.self, CHARGE, amount, maxCharge);
    syncPeerage(ctx);
  };
  const grantMerit = (ctx: BattleApi, target: UnitView) => {
    const previous = holder(ctx.allies);
    if (previous !== target) {
      if (previous) {
        ctx.removeStatus(previous, merit);
        ctx.removeStatus(previous, peerage);
        ctx.setCounter(ctx.self, CHARGE, 0);
      }
      ctx.applyStatus(target, merit);
    }
    const teammate = target !== ctx.self;
    for (const [reached, status] of [
      [k.e(2), forgeTheDreams],
      [k.e(6), journeyStarward],
    ] as const) {
      if (reached && teammate) ctx.applyStatus(ctx.self, status);
      else ctx.removeStatus(ctx.self, status);
    }
  };

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
    target: "ally",
    before: (ctx) => {
      const chosen = ctx.target;
      const target =
        chosen && !isEnemy(chosen) && chosen.kind === "character"
          ? chosen
          : (holder(ctx.allies) ?? designate(ctx.self, ctx.allies) ?? ctx.self);
      grantMerit(ctx, target);
      gainCharge(ctx, k.param("02", 2));
      if (k.a(3)) {
        ctx.applyStatus(ctx.self, vici);
        if (target !== ctx.self) ctx.applyStatus(target, vici);
      }
      if (k.e(1)) ctx.gainEnergy(target, k.rankParam(1, 3));
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    before: (ctx) => {
      gainCharge(ctx, k.param("03", 2));
      ctx.setCounter(ctx.self, PROCS, 0);
    },
    after: (ctx) => {
      if (holder(ctx.allies)) return;
      const first = allyCharacters(ctx.allies)[0];
      if (!first) return;
      grantMerit(ctx, first);
      syncPeerage(ctx);
    },
  });

  // Coup de Main copies the Skill and uses it before the original. The
  // engine can only queue it after: the first use keeps Peerage (the copy)
  // and the queued one runs with Military Merit (the original), refunding
  // the Skill Points it would spend again.
  k.on(
    "actionStart",
    "talent",
    {
      subject: "ally",
      abilityKinds: ["basic", "skill"],
      when: (event) => event.unit.has(merit),
    },
    (ctx, event) => {
      ctx.setCounter(ctx.self, ORIGINAL, 0);
      if (
        event.abilityKind === "skill" &&
        event.abilityId &&
        event.attack &&
        isEnemy(event.target) &&
        event.unit.has(peerage)
      ) {
        ctx.setCounter(ctx.self, COUP, 1);
        ctx.queueAction(event.unit, event.abilityId, { target: event.target });
        return;
      }
      gainCharge(ctx, k.param("04", 1));
    }
  );
  k.on(
    "actionEnd",
    "skill",
    {
      subject: "ally",
      abilityKinds: ["skill"],
      when: (event, self) => self.counter(COUP) > 0 && event.unit.has(merit),
    },
    (ctx, event) => {
      ctx.setCounter(ctx.self, COUP, 0);
      ctx.addCounter(ctx.self, CHARGE, -peerageCharge);
      ctx.removeStatus(event.unit, peerage);
      ctx.setCounter(ctx.self, ORIGINAL, 1);
    }
  );
  k.on(
    "skillPointsChanged",
    "skill",
    {
      subject: "ally",
      when: (event, self) =>
        self.counter(ORIGINAL) > 0 &&
        (event.delta ?? 0) < 0 &&
        event.unit.has(merit),
    },
    (ctx, event) => ctx.gainSkillPoints(-(event.delta ?? 0))
  );

  k.on(
    "actionEnd",
    "talent",
    {
      subject: "ally",
      attack: true,
      when: (event, self) =>
        event.unit.kind === "character" &&
        event.unit.has(merit) &&
        self.counter(PROCS) < k.param("04", 4),
    },
    (ctx, event) => {
      const target = isEnemy(event.target)
        ? event.target
        : (event.targetsHit?.[0] ?? ctx.mainTarget);
      if (!target) return;
      ctx.addCounter(ctx.self, PROCS, 1);
      ctx.deal(
        { shape: "single", main: k.param("04", 3), onlyTags: ["additional"] },
        { targets: [target], abilityId: "military-merit", origin: "talent" }
      );
    }
  );

  if (k.a(2)) {
    k.on(
      "actionStart",
      "a4",
      {
        subject: "ally",
        abilityKinds: ["ultimate"],
        when: (event, self) =>
          event.unit.has(merit) &&
          self.counter(A4_USED) < 1 &&
          self.counter(CHARGE) < maxCharge,
      },
      (ctx) => {
        ctx.setCounter(ctx.self, A4_USED, 1);
        gainCharge(ctx, k.traceParam(2, 2));
      }
    );
  }
  if (k.a(3)) {
    k.on(
      "actionStart",
      "a6",
      {
        subject: "ally",
        abilityKinds: ["basic", "skill"],
        when: (event) => event.unit.has(merit),
      },
      (ctx) => ctx.gainEnergy(ctx.self, k.traceParam(3, 1))
    );
  }

  k.policy({
    // Skill to place Military Merit, then only with a Skill Point left over
    // for the holder's own Skill.
    turn: (view) => {
      const current = holder(view.allies);
      const target = current ?? designate(view.self, view.allies) ?? view.self;
      return view.skillPoints >= (current ? 2 : 1)
        ? { ability: "skill", target }
        : "basic";
    },
  });
});
