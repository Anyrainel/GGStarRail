import { type BattleApi, isEnemy, type UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Hanya — Harmony, Physical. */
export default defineCharacter("1215", (k) => {
  const BURDEN_ATTACKS = "burden-attacks";
  const BURDEN_RECOVERIES = "burden-recoveries";
  // "For every 2 ... allies will immediately recover 1 Skill Point" has no
  // placeholders.
  const attacksPerRecovery = 2;
  const recoveryLimit = k.param("02", 2);

  // Neither a buff nor a debuff in game (StatusType Other).
  const burden = k.status({ id: "burden", origin: "skill" });
  const sanction = k.status({
    id: "sanction",
    origin: "talent",
    duration: { turns: k.param("04", 2) },
    modifiers: [
      {
        stat: "dmgBoost",
        value: k.param("04", 1) + (k.e(6) ? k.rankParam(6, 1) : 0),
      },
    ],
  });
  const scrivener = k.status({
    id: "scrivener",
    origin: "a2",
    duration: { turns: k.traceParam(1, 2) },
    modifiers: [{ stat: "atkPct", value: k.traceParam(1, 1) }],
  });

  const decreeTurns = k.param("03", 2) + (k.e(4) ? k.rankParam(4, 1) : 0);
  const decree = k.status({
    id: "ten-lords-decree",
    origin: "ultimate",
    duration: { turns: decreeTurns },
    modifiers: [
      { stat: "atkPct", value: k.param("03", 1) },
      {
        stat: "spdFlat",
        scaling: { source: "applier", stat: "spd", ratio: k.param("03", 3) },
      },
    ],
  });

  // Kills are not simulated; when on, the enemy with Burden is assumed to be
  // defeated at its first Skill Point recovery.
  const burdenDefeat =
    k.a(2) && k.toggle("a4-burden-defeat", "a4", "enemyDefeated", false);
  // Kills are not simulated; when on, each attack by the Ultimate's target
  // is assumed to defeat an enemy.
  const decreeDefeat =
    k.e(1) && k.toggle("e1-defeat", "e1", "enemyDefeated", false);

  const endBurden = (ctx: BattleApi) => {
    for (const enemy of ctx.enemies) ctx.removeStatus(enemy, burden);
    ctx.setCounter(ctx.self, BURDEN_ATTACKS, 0);
    ctx.setCounter(ctx.self, BURDEN_RECOVERIES, 0);
  };

  const burdenAction = {
    subject: "ally",
    abilityKinds: ["basic", "skill", "ultimate"],
    attack: true,
  } as const;

  k.on(
    "actionEnd",
    "skill",
    {
      ...burdenAction,
      // Hanya's Skill applies a fresh Burden after its hits.
      when: (event, self) =>
        !(event.unit === self && event.abilityId === "skill") &&
        (event.targetsHit ?? []).some((enemy) => enemy.has(burden)),
    },
    (ctx, event) => {
      ctx.addCounter(ctx.self, BURDEN_ATTACKS, 1);
      const attacks = ctx.self.counter(BURDEN_ATTACKS);
      if (attacks < attacksPerRecovery - 1e-9) return;
      ctx.setCounter(ctx.self, BURDEN_ATTACKS, attacks - attacksPerRecovery);
      ctx.addCounter(ctx.self, BURDEN_RECOVERIES, 1);
      ctx.gainSkillPoints(1);
      if (k.a(1)) ctx.applyStatus(event.unit, scrivener);
      if (k.a(3)) ctx.gainEnergy(ctx.self, k.traceParam(3, 1));
      const recoveries = ctx.self.counter(BURDEN_RECOVERIES);
      if (burdenDefeat && recoveries <= k.traceParam(2, 1) + 1e-9) {
        ctx.gainSkillPoints(k.traceParam(2, 2));
        endBurden(ctx);
      } else if (recoveries >= recoveryLimit - 1e-9) {
        endBurden(ctx);
      }
    }
  );

  k.on(
    "actionStart",
    "talent",
    {
      ...burdenAction,
      when: (event) => isEnemy(event.target) && event.target.has(burden),
    },
    (ctx, event) => ctx.applyStatus(event.unit, sanction)
  );

  if (decreeDefeat) {
    k.on(
      "actionEnd",
      "e1",
      {
        subject: "ally",
        attack: true,
        when: (event) => event.unit.has(decree),
        limitPerTurn: k.rankParam(1, 2),
      },
      (ctx) => ctx.advanceAction(ctx.self, k.rankParam(1, 1))
    );
  }

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  const e2Spd = k.status({
    id: "e2-spd",
    origin: "e2",
    duration: { turns: k.rankParam(2, 2) },
    modifiers: [{ stat: "spdPct", value: k.rankParam(2, 1) }],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    after: (ctx) => {
      if (isEnemy(ctx.target)) {
        endBurden(ctx);
        ctx.applyStatus(ctx.target, burden);
      }
      if (k.e(2)) ctx.applyStatus(ctx.self, e2Spd);
    },
  });

  // The Ultimate's ally: by default the first damage dealer, else a
  // Nihility teammate, else the first teammate.
  const damagePaths = ["Mage", "Warrior", "Rogue", "Memory", "Elation"];
  const decreeMember = k.ally(
    "decree-target",
    "ultimate",
    (candidates) => {
      const others = candidates.filter((member) => member.characterId !== k.id);
      return (
        others.find((member) => damagePaths.includes(member.pathId)) ??
        others.find((member) => member.pathId === "Warlock") ??
        others[0]
      );
    },
    { includeSelf: true }
  );
  const decreeTarget = (view: {
    self: UnitView;
    allies: readonly UnitView[];
  }): UnitView =>
    view.allies.find(
      (ally) => ally.kind === "character" && ally.slot === decreeMember?.slot
    ) ?? view.self;

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "ally",
    before: (ctx) => {
      const ally =
        ctx.target && !isEnemy(ctx.target) ? ctx.target : decreeTarget(ctx);
      ctx.applyStatus(ally, decree);
    },
  });

  // Skill to place Burden once the previous one is spent (or Skill Points
  // are capped); Basic ATK while it still has recoveries left.
  k.policy({
    turn: (view) => {
      if (view.skillPoints < 1) return "basic";
      const marked = view.enemies.some((enemy) => enemy.has(burden));
      return !marked || view.skillPoints >= view.maxSkillPoints
        ? "skill"
        : "basic";
    },
    ultimate: (view) => ({ ability: "ultimate", target: decreeTarget(view) }),
  });
});
