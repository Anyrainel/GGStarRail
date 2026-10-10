import { isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/** Gepard — Preservation, Ice. */
export default defineCharacter("1104", (k) => {
  const freezeChance = k.param("02", 2) + (k.e(1) ? k.rankParam(1, 1) : 0);
  const freeze = k.status({
    id: "freeze",
    origin: "skill",
    debuff: true,
    family: "frozen",
    skipsTurn: true,
    duration: { turns: k.param("02", 3) },
  });

  const lingeringCold = k.status({
    id: "lingering-cold",
    origin: "e2",
    debuff: true,
    family: "slow",
    duration: { turns: k.rankParam(2, 2) },
    modifiers: [{ stat: "spdPct", value: -k.rankParam(2, 1) }],
  });

  if (k.a(3)) {
    // "Refreshes at the start of each turn": read as his final DEF.
    k.stat("a6", {
      stat: "atkFlat",
      scaling: { source: "holder", stat: "def", ratio: k.traceParam(3, 1) },
    });
  }

  if (k.e(4)) {
    k.teamStat("e4", { stat: "effectRes", value: k.rankParam(4, 1) });
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
    hits: [
      { shape: "single", main: k.param("02", 1), toughness: { main: 20 } },
    ],
    after: (ctx) => {
      if (isEnemy(ctx.target)) {
        ctx.applyStatus(ctx.target, freeze, { baseChance: freezeChance });
      }
    },
  });

  // Shields for all allies: not modelled (U12).
  k.ability({ id: "ultimate", kind: "ultimate", target: "allies" });

  // The engine skips a Frozen enemy's turn with the base chance (Effect Hit
  // Rate is not read for the timeline); the turn-start DMG uses the same
  // expected chance (tracker engine-control-turn-start-dmg).
  const frozenWeight = Math.min(1, freezeChance);
  k.on(
    "turnStart",
    "skill",
    {
      subject: "enemy",
      when: (event, self) => event.unit.has(freeze, self),
    },
    (ctx, event) => {
      if (!isEnemy(event.unit)) return;
      ctx.deal(
        { shape: "single", main: k.param("02", 4), onlyTags: ["additional"] },
        {
          targets: [event.unit],
          abilityId: "freeze",
          origin: "skill",
          weight: frozenWeight,
        }
      );
    }
  );

  if (k.e(2)) {
    // The Freeze ends with the Frozen enemy's turn. Applied during that
    // turn, the Slow lasts through the enemy's next turn; it exists where the
    // Freeze landed.
    k.on(
      "turnEnd",
      "e2",
      {
        subject: "enemy",
        when: (event, self) => event.unit.has(freeze, self),
      },
      (ctx, event) =>
        ctx.applyStatus(event.unit, lingeringCold, {
          baseChance: freezeChance,
        })
    );
  }

  // The Talent (and A4, E6) trigger on a killing blow; HP is not simulated.

  // Basic ATK to leave Skill Points to the team; Skill when they would
  // otherwise pile up.
  k.policy({
    turn: (view) =>
      view.skillPoints >= view.maxSkillPoints - 1 ? "skill" : "basic",
  });
});
