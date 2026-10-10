import {
  type ActionContext,
  type BattleApi,
  isEnemy,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

const A4_GAINED = "sensory-latitude-gained";
const EXTRA_TURN_PENDING = "archetype-extra-turn";
const EXTRA_TURN_PUNCHLINE = "archetype-extra-punchline";

// Pearl (4.6) is newer than the pinned TurnBasedGameData. Her facts come
// from TurnBasedGameData 312b459 (4.6.0) AvatarSkillConfig: the Basic ATK,
// Skill, Ultimate, and Elation Skill match the kind conventions; the
// Enhanced Basic ATKs set their own.

/** Pearl — Elation, Ice. */
export default defineCharacter("1503", (k) => {
  const elationCount = Math.max(1, k.countPath("Elation"));
  const bangerCap = k.param("04", 3);

  // Pearl's Certified Banger lasts indefinitely, up to the Talent's limit.
  const gainBanger = (ctx: BattleApi, amount: number) => {
    const room = bangerCap - ctx.self.certifiedBanger();
    const gained = Math.min(amount, room);
    if (gained > 1e-9) {
      ctx.grantCertifiedBanger(ctx.self, gained, Number.POSITIVE_INFINITY);
    }
    return Math.max(0, gained);
  };

  if (k.a(1)) {
    k.stat("a2", {
      stat: "elation",
      scaling: {
        source: "holder",
        stat: "def",
        atLeast: k.traceParam(1, 1),
        ratio: k.traceParam(1, 2),
      },
    });
    k.stat("a2", {
      stat: "elation",
      scaling: {
        source: "holder",
        stat: "def",
        threshold: k.traceParam(1, 1),
        step: k.traceParam(1, 3),
        ratio: k.traceParam(1, 4),
        cap: (k.traceParam(1, 5) / k.traceParam(1, 3)) * k.traceParam(1, 4),
      },
    });
  }
  if (k.a(1)) {
    // "Outgoing Healing Boost equal to 20% of this unit's Elation": scaling
    // never reads other scaling, so the DEF-based Elation above is repeated
    // in DEF terms.
    const share = k.traceParam(1, 6);
    k.stat("a2", {
      stat: "outgoingHealing",
      scaling: { source: "holder", stat: "elation", ratio: share },
    });
    k.stat("a2", {
      stat: "outgoingHealing",
      scaling: {
        source: "holder",
        stat: "def",
        atLeast: k.traceParam(1, 1),
        ratio: share * k.traceParam(1, 2),
      },
    });
    k.stat("a2", {
      stat: "outgoingHealing",
      scaling: {
        source: "holder",
        stat: "def",
        threshold: k.traceParam(1, 1),
        step: k.traceParam(1, 3),
        ratio: share * k.traceParam(1, 4),
        cap:
          share *
          (k.traceParam(1, 5) / k.traceParam(1, 3)) *
          k.traceParam(1, 4),
      },
    });
  }
  if (k.e(1) && elationCount >= 2) {
    k.teamStat("e1", {
      stat: "elation",
      value: k.rankParam(1, Math.min(4, elationCount) - 1),
    });
  }
  if (k.e(2))
    k.teamStat("e2", { stat: "merrymaking", value: k.rankParam(2, 1) });

  if (k.a(2)) {
    k.on("turnStart", "a4", { subject: "self" }, (ctx) =>
      ctx.setCounter(ctx.self, A4_GAINED, 0)
    );
    k.on(
      "turnStart",
      "a4",
      {
        subject: "ally",
        when: (event, self) =>
          (event.unit.kind === "character" ||
            event.unit.kind === "memosprite") &&
          self.counter(A4_GAINED) < k.traceParam(2, 2),
      },
      (ctx) => {
        const allowed = k.traceParam(2, 2) - ctx.self.counter(A4_GAINED);
        const gained = gainBanger(ctx, Math.min(k.traceParam(2, 1), allowed));
        ctx.addCounter(ctx.self, A4_GAINED, gained);
      }
    );
  }

  const deepLearning = k.status({
    id: "deep-learning",
    origin: "ultimate",
    maxStacks: k.param("03", 1),
  });
  const archetype = k.status({ id: "aesthetic-archetype", origin: "ultimate" });
  const deepLearningPen = k.status({
    id: "compute-life",
    origin: "e6",
    modifiers: [{ stat: "resPen", value: k.rankParam(6, 1) }],
  });
  const firewall = k.status({ id: "aesthetic-firewall", origin: "a6" });

  const archetypeOf = (allies: readonly UnitView[]) =>
    allies.find((ally) => ally.has(archetype)) ?? null;

  // "Restores HP for all ally targets ... and additionally restores HP for
  // the ally target with the lowest current HP percentage" (chosen before
  // the first heal).
  const healTeam = (ctx: BattleApi, defRatio: number, flat: number) => {
    const amount =
      (defRatio * ctx.self.panelStat("def") + flat) *
      (1 + ctx.self.panelStat("outgoingHealing"));
    const heal = (ally: UnitView) => {
      const maxHp = ally.panelStat("hp");
      if (maxHp > 0) ctx.heal(ally, amount / maxHp);
    };
    const lowest = ctx.allies.reduce<UnitView | null>(
      (low, ally) => (!low || ally.hpRatio < low.hpRatio ? ally : low),
      null
    );
    for (const ally of ctx.allies) heal(ally);
    if (lowest) heal(lowest);
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      {
        shape: "single",
        main: k.param("01", 1),
        stat: "def",
        toughness: { main: 10 },
      },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "allies",
    before: (ctx) => {
      gainBanger(ctx, k.param("02", 1));
      healTeam(ctx, k.param("02", 2), k.param("02", 3));
    },
  });

  // Elation DMG from the Ultimate and E6 uses the Aesthetic Archetype's
  // stats; it is assumed to hit the same enemies as the AoE attack.
  const archetypeHits = (ctx: ActionContext, elation: boolean) => {
    const archetypeUnit = archetypeOf(ctx.allies);
    const targets = ctx.targetsHit();
    if (!archetypeUnit || targets.length === 0) return;
    const multiplier =
      (elation ? k.param("03", 2) : 0) + (k.e(6) ? k.rankParam(6, 2) : 0);
    if (multiplier <= 0) return;
    ctx.deal(
      {
        shape: "aoe",
        each: multiplier,
        kind: "elation",
        combatType: "Ice",
        onlyTags: ["elation"],
      },
      { attacker: archetypeUnit, targets }
    );
  };
  const spendCharge = (ctx: BattleApi) => {
    ctx.consumeStacks(ctx.self, deepLearning, 1);
    if (ctx.self.has(deepLearning)) return;
    for (const ally of ctx.allies) {
      ctx.removeStatus(ally, archetype);
      ctx.removeStatus(ally, deepLearningPen);
    }
  };

  // Enhanced Basic ATKs (312b459): 30 Toughness per enemy, 30 Energy.
  k.ability({
    id: "greatWave",
    kind: "basic",
    energy: 30,
    hits: [
      {
        shape: "aoe",
        each: k.param("10", 1),
        stat: "def",
        toughness: { each: 30 },
      },
    ],
    after: (ctx) => {
      healTeam(ctx, k.param("10", 2), k.param("10", 4));
      archetypeHits(ctx, false);
      spendCharge(ctx);
    },
  });

  k.ability({
    id: "starryNight",
    kind: "basic",
    energy: 30,
    hits: (ctx) => {
      const hits: HitDef[] = [
        {
          shape: "aoe",
          each: k.param("08", 1),
          stat: "def",
          toughness: { each: 30 },
        },
      ];
      const banger = ctx.self.certifiedBanger();
      if (banger > 0) {
        hits.push({
          shape: "aoe",
          each: k.param("08", 5),
          kind: "elation",
          onlyTags: ["elation"],
          punchline: banger,
        });
      }
      return hits;
    },
    after: (ctx) => {
      healTeam(ctx, k.param("08", 2), k.param("08", 4));
      archetypeHits(ctx, true);
      spendCharge(ctx);
    },
  });

  // The Aesthetic Archetype: by default the first other Elation Character,
  // else the first other Character.
  const archetypeMember = k.ally(
    "aesthetic-archetype",
    "ultimate",
    (candidates) =>
      candidates.find((member) => member.pathId === "Elation") ?? candidates[0]
  );
  const chooseArchetype = (view: { allies: readonly UnitView[] }) =>
    view.allies.find(
      (ally) => ally.kind === "character" && ally.slot === archetypeMember?.slot
    );
  const advance = k.param("03", 3 + Math.min(3, elationCount));
  const extraTurnScale = k.e(2) ? 1 + k.rankParam(2, 2) : 1;

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "ally",
    before: (ctx) => {
      gainBanger(ctx, k.param("03", 3));
      for (const ally of ctx.allies) ctx.removeStatus(ally, archetype);
      const named = ctx.target;
      const chosen =
        named &&
        !isEnemy(named) &&
        named.kind === "character" &&
        named !== ctx.self
          ? named
          : chooseArchetype(ctx);
      ctx.applyStatus(ctx.self, deepLearning, { setStacks: k.param("03", 1) });
      if (k.e(6)) {
        for (const ally of ctx.allies) ctx.applyStatus(ally, deepLearningPen);
      }
      if (!chosen) return;
      ctx.applyStatus(chosen, archetype);
      ctx.advanceAction(chosen, advance);
      if (k.e(2)) {
        for (const ally of ctx.allies) {
          if (
            ally.kind === "character" &&
            ally.pathId === "Elation" &&
            ally !== ctx.self &&
            ally !== chosen
          ) {
            ctx.advanceAction(ally, advance);
          }
        }
      }
      if (elationCount >= 4) {
        ctx.grantExtraTurn(chosen);
        // Granted now for 1 turn so it ends with the extra turn; the text
        // grants it when the extra turn starts.
        ctx.grantCertifiedBanger(chosen, k.param("03", 8) * extraTurnScale, 1);
        ctx.setCounter(ctx.self, EXTRA_TURN_PENDING, 1);
      }
      if (k.a(3) && chosen.pathId === "Elation") {
        ctx.applyStatus(chosen, firewall);
      }
    },
  });

  if (elationCount >= 4) {
    k.on(
      "turnStart",
      "ultimate",
      {
        subject: "otherAlly",
        when: (event, self) =>
          event.extraTurn === true &&
          event.unit.has(archetype) &&
          self.counter(EXTRA_TURN_PENDING) > 0,
      },
      (ctx) => {
        const punchline = k.param("03", 7) * extraTurnScale;
        ctx.setCounter(ctx.self, EXTRA_TURN_PENDING, 0);
        ctx.setCounter(ctx.self, EXTRA_TURN_PUNCHLINE, punchline);
        ctx.addTeamResource("punchline", punchline);
      }
    );
    k.on(
      "turnEnd",
      "ultimate",
      {
        subject: "otherAlly",
        when: (event, self) =>
          event.extraTurn === true && self.counter(EXTRA_TURN_PUNCHLINE) > 0,
      },
      (ctx) => {
        ctx.addTeamResource(
          "punchline",
          -ctx.self.counter(EXTRA_TURN_PUNCHLINE)
        );
        ctx.setCounter(ctx.self, EXTRA_TURN_PUNCHLINE, 0);
      }
    );
  }

  if (k.a(3)) {
    k.on(
      "actionEnd",
      "a6",
      {
        subject: "otherAlly",
        abilityKinds: ["ultimate"],
        when: (event) => event.unit.has(firewall),
      },
      (ctx, event) => {
        ctx.gainEnergy(ctx.self, k.traceParam(3, 1), { fixed: true });
        ctx.removeStatus(event.unit, firewall);
      }
    );
  }

  const dissolve = k.status({ id: "dissolve-reason", origin: "elationSkill" });
  const dissolveMultiplier =
    k.param("20", Math.min(4, elationCount)) *
    (k.e(4) ? 1 + k.rankParam(4, 1) : 1);

  k.ability({
    id: "elationSkill",
    kind: "elationSkill",
    target: "allies",
    before: (ctx) => {
      for (const ally of ctx.allies) ctx.applyStatus(ally, dissolve);
    },
  });

  k.on(
    "actionEnd",
    "elationSkill",
    {
      subject: "ally",
      attack: true,
      when: (event) => event.unit.has(dissolve),
    },
    (ctx, event) => {
      const target = isEnemy(event.target)
        ? event.target
        : event.targetsHit?.[0];
      if (target) {
        ctx.deal(
          {
            shape: "single",
            main: dissolveMultiplier,
            kind: "elation",
            onlyTags: ["elation"],
          },
          {
            attacker: event.unit,
            targets: [target],
            abilityId: "dissolveReason",
          }
        );
      }
      ctx.removeStatus(event.unit, dissolve);
    }
  );

  // Sustain: Enhanced Basic ATK while Deep Learning lasts; the Skill when
  // Pearl holds no Certified Banger or an ally is at 50% HP or lower.
  const hurtThreshold = k.param("04", 1);
  k.policy({
    turn: (view) => {
      if (view.self.has(deepLearning)) {
        return archetypeOf(view.allies)?.pathId === "Elation"
          ? "starryNight"
          : "greatWave";
      }
      const hurt = view.allies.some(
        (ally) =>
          ally.kind === "character" && ally.hpRatio <= hurtThreshold + 1e-9
      );
      return (view.self.certifiedBanger() <= 0 || hurt) && view.skillPoints >= 1
        ? "skill"
        : "basic";
    },
    ultimate: (view) => {
      const target = chooseArchetype(view);
      return target ? { ability: "ultimate", target } : true;
    },
  });
});
