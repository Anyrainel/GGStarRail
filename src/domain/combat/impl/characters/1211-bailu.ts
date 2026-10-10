import {
  type BattleApi,
  isEnemy,
  type PolicyView,
  type UnitView,
} from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Remaining turns of Invigoration on a Character. */
const INVIGORATION = "bailu-invigoration";
/** Remaining heals of that Invigoration. */
const INVIGORATION_HEALS = "bailu-invigoration-heals";

/** Bailu — Abundance, Lightning. */
export default defineCharacter("1211", (k) => {
  const qihuangAnalects = k.status({
    id: "qihuang-analects",
    origin: "a2",
    duration: { turns: k.traceParam(1, 2) },
    modifiers: [{ stat: "hpPct", value: k.traceParam(1, 1) }],
  });
  const evilExcision = k.status({
    id: "evil-excision",
    origin: "e4",
    duration: { turns: k.rankParam(4, 3) },
    maxStacks: k.rankParam(4, 2),
    modifiers: [{ stat: "dmgBoost", value: k.rankParam(4, 1) }],
  });

  // HP is not simulated. A2 needs the healed ally at full HP (overhealing),
  // and E1 needs full HP when Invigoration ends.
  const overheal =
    k.a(1) && k.toggle("a2-overheal", "a2", "selfHpAbove", true, 1);
  const fullHpAtEnd =
    k.e(1) && k.toggle("e1-full-hp", "e1", "selfHpAbove", true, 1);

  /** A heal reaching `ally` with probability `chance`. */
  const healed = (ctx: BattleApi, ally: UnitView, chance = 1) => {
    if (overheal) ctx.applyStatus(ally, qihuangAnalects, { stacks: chance });
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
  });

  // One heal on the target, then random heals spread over all ally targets.
  k.ability({
    id: "skill",
    kind: "skill",
    target: "ally",
    after: (ctx) => {
      const target = ctx.target && !isEnemy(ctx.target) ? ctx.target : ctx.self;
      const randomHeals = k.param("02", 4);
      const share = 1 / ctx.allies.length;
      for (const ally of ctx.allies) {
        const first = ally === target ? 1 : 0;
        const missed = (1 - first) * (1 - share) ** randomHeals;
        healed(ctx, ally, 1 - missed);
        if (k.e(4)) {
          ctx.applyStatus(ally, evilExcision, {
            stacks: first + randomHeals * share,
          });
        }
      }
    },
  });

  const invigorationHeals =
    k.param("04", 5) + (k.a(2) ? k.traceParam(2, 1) : 0);
  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "allies",
    before: (ctx) => {
      for (const ally of ctx.allies) {
        healed(ctx, ally);
        if (ally.kind !== "character") continue;
        const remaining = ally.counter(INVIGORATION);
        if (remaining > 1e-9) {
          ctx.setCounter(ally, INVIGORATION, remaining + 1);
        } else {
          ctx.setCounter(ally, INVIGORATION, k.param("03", 3));
          ctx.setCounter(ally, INVIGORATION_HEALS, invigorationHeals);
        }
      }
    },
  });

  // Invigoration is tracked as counters because E1 reacts to its end. It
  // counts down at the end of the holder's turns.
  k.on(
    "turnEnd",
    "ultimate",
    {
      subject: "ally",
      when: (event) => event.unit.counter(INVIGORATION) > 1e-9,
    },
    (ctx, event) => {
      const remaining = event.unit.counter(INVIGORATION) - 1;
      ctx.setCounter(event.unit, INVIGORATION, Math.max(0, remaining));
      if (remaining > 1e-9) return;
      ctx.setCounter(event.unit, INVIGORATION_HEALS, 0);
      if (fullHpAtEnd) ctx.gainEnergy(event.unit, k.rankParam(1, 1));
    }
  );

  // Talent: an Invigorated ally heals after being hit.
  k.on(
    "hitByEnemy",
    "talent",
    {
      subject: "ally",
      when: (event) =>
        event.unit.counter(INVIGORATION) > 1e-9 &&
        event.unit.counter(INVIGORATION_HEALS) > 1e-9,
    },
    (ctx, event) => {
      ctx.addCounter(event.unit, INVIGORATION_HEALS, -1);
      healed(ctx, event.unit, ctx.weight);
    }
  );

  const firstTeammate = (view: PolicyView): UnitView =>
    view.allies.find(
      (ally) => ally.kind === "character" && ally !== view.self
    ) ?? view.self;

  // Basic ATK keeps Skill Points for the team. At E4 surplus Skill Points go
  // to the Skill's DMG bonus on the first teammate.
  k.policy({
    turn: (view) =>
      k.e(4) && view.skillPoints >= 3
        ? { ability: "skill", target: firstTeammate(view) }
        : "basic",
  });
});
