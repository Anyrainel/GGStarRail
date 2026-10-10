import type { ActionContext, BattleApi } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** Trailblazer (Preservation) — Preservation, Fire. */
export default defineCharacter("8003", (k) => {
  const MAGMA_WILL = "magma-will";
  const maxMagmaWill = k.param("04", 3);
  // "Consumes 4 stacks" / "no fewer than 4 stacks" carry no placeholder.
  const ENHANCE_COST = 4;

  // Ultimate: the next Basic ATK is enhanced without consuming Magma Will.
  const warFlamingLance = k.status({
    id: "war-flaming-lance",
    origin: "ultimate",
  });
  // Shields are not modelled; this marks the Talent's own Shield (re-applied
  // by every Basic ATK, Skill, and Ultimate) so A6 can check for it.
  const talentShield = k.status({
    id: "treasure-of-the-architects-shield",
    origin: "talent",
    duration: { turns: k.param("04", 2) },
  });
  const taunt = k.status({
    id: "ever-burning-amber-taunt",
    origin: "skill",
    debuff: true,
    duration: { turns: k.param("02", 3) },
  });
  const actionBeatsOverthinking = k.status({
    id: "action-beats-overthinking",
    origin: "a6",
    modifiers: [{ stat: "atkPct", value: k.traceParam(3, 2) }],
  });
  const cityForgingBulwarks = k.status({
    id: "city-forging-bulwarks",
    origin: "e6",
    maxStacks: k.rankParam(6, 2),
    modifiers: [{ stat: "defPct", value: k.rankParam(6, 1) }],
  });

  const gainMagmaWill = (ctx: BattleApi, stacks: number) =>
    ctx.addCounter(ctx.self, MAGMA_WILL, stacks, maxMagmaWill);
  const markTalentShield = (ctx: ActionContext) =>
    ctx.applyStatus(ctx.self, talentShield);

  // E1: "additionally deals Fire DMG equal to X% of DEF", taken as a second
  // scaling part of the same instance.
  const e1Rider = (ratio: number): HitDef[] =>
    k.e(1) ? [{ shape: "single", main: ratio, stat: "def", silent: true }] : [];

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
      ...e1Rider(k.rankParam(1, 1)),
    ],
    after: (ctx) => {
      gainMagmaWill(ctx, 1);
      markTalentShield(ctx);
    },
  });

  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    energy: 30,
    usable: (view) =>
      view.self.has(warFlamingLance) ||
      view.self.counter(MAGMA_WILL) >= ENHANCE_COST - 1e-9,
    hits: [
      {
        shape: "blast",
        main: k.param("08", 1),
        adjacent: k.param("08", 2),
        toughness: { main: 20, adjacent: 10 },
      },
      ...e1Rider(k.rankParam(1, 2)),
    ],
    before: (ctx) => {
      if (ctx.self.has(warFlamingLance)) {
        ctx.removeStatus(ctx.self, warFlamingLance);
      } else {
        gainMagmaWill(ctx, -ENHANCE_COST);
      }
    },
    after: (ctx) => {
      markTalentShield(ctx);
      if (k.e(6)) ctx.applyStatus(ctx.self, cityForgingBulwarks);
    },
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "self",
    after: (ctx) => {
      gainMagmaWill(ctx, 1);
      for (const enemy of ctx.enemies) {
        ctx.applyStatus(enemy, taunt, { baseChance: k.param("02", 2) });
      }
      markTalentShield(ctx);
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [
      { shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } },
      { shape: "aoe", each: k.param("03", 2), stat: "def", silent: true },
    ],
    after: (ctx) => {
      ctx.applyStatus(ctx.self, warFlamingLance);
      markTalentShield(ctx);
      if (k.e(6)) ctx.applyStatus(ctx.self, cityForgingBulwarks);
    },
  });

  k.on("hitByEnemy", "talent", { subject: "self" }, (ctx) =>
    gainMagmaWill(ctx, 1)
  );

  if (k.e(4)) {
    k.on("battleStart", "e4", { subject: "any" }, (ctx) =>
      gainMagmaWill(ctx, k.rankParam(4, 1))
    );
  }

  if (k.a(3)) {
    k.on(
      "turnStart",
      "a6",
      { subject: "self", when: (_event, self) => self.has(talentShield) },
      (ctx) => {
        ctx.applyStatus(ctx.self, actionBeatsOverthinking);
        ctx.gainEnergy(ctx.self, k.traceParam(3, 1));
      }
    );
    k.on("actionEnd", "a6", { subject: "self" }, (ctx) =>
      ctx.removeStatus(ctx.self, actionBeatsOverthinking)
    );
  }

  // Enhanced Basic ATK whenever it is available; otherwise Basic ATK keeps
  // the team's Skill Points up, with a Skill (Taunt) only when a Basic ATK
  // would overflow the Skill Point cap.
  k.policy({
    turn: (view) => {
      if (
        view.self.has(warFlamingLance) ||
        view.self.counter(MAGMA_WILL) >= ENHANCE_COST - 1e-9
      ) {
        return "enhancedBasic";
      }
      return view.skillPoints >= view.maxSkillPoints ? "skill" : "basic";
    },
  });
});
