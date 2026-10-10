import {
  type CombatTypeId,
  DMG_BOOST_STAT_BY_COMBAT_TYPE,
} from "@/domain/stats";
import type { BattleApi } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { HitDef } from "../../kit/model";

/** Silver Wolf LV.999 — Elation, Imaginary. */
export default defineCharacter("1506", (k) => {
  const PUNCHLINE = "punchline";
  const MMR = "hidden-mmr";
  const USES = "enhanced-basic-uses";
  const CHANCE = "loot-box-chance";
  const E2_PROGRESS = "e2-mmr-progress";
  const mmrThreshold = k.param("04", 1);
  const mmrMax = mmrThreshold + k.param("04", 2);

  if (k.a(1)) {
    // "When SPD is 160 or higher, +50%; +2% per SPD exceeded, up to 100".
    k.stat("a2", {
      stat: "elation",
      scaling: {
        source: "holder",
        stat: "spd",
        atLeast: k.traceParam(1, 1),
        ratio: k.traceParam(1, 2),
      },
    });
    k.stat("a2", {
      stat: "elation",
      scaling: {
        source: "holder",
        stat: "spd",
        threshold: k.traceParam(1, 1),
        step: k.traceParam(1, 3),
        ratio: k.traceParam(1, 4),
        cap: k.traceParam(1, 4) * k.traceParam(1, 5),
      },
    });
  }

  const godmode = k.status({ id: "godmode-player", origin: "ultimate" });
  const mmrCritRate = k.status({
    id: "hidden-mmr",
    origin: "talent",
    maxStacks: mmrMax,
    modifiers: [{ stat: "critRate", value: k.param("04", 4) }],
  });
  // Hidden MMR past 100% CRIT Rate gives CRIT DMG instead: each excess 0.4%
  // CRIT Rate is 0.8% CRIT DMG. CRIT Rate above 100% without Hidden MMR also
  // converts here (rare).
  const mmrCritDmg = k.status({
    id: "hidden-mmr-overflow",
    origin: "talent",
    modifiers: [
      {
        stat: "critDmg",
        scaling: {
          source: "holder",
          stat: "critRate",
          threshold: 1,
          ratio: k.param("04", 6) / k.param("04", 4),
        },
      },
    ],
  });
  const enhancedBoost = k.status({
    id: "enhanced-basic-mmr",
    origin: "basic",
    maxStacks: k.param("08", 7),
    modifiers: [{ stat: "dmgMultiplier", value: k.param("08", 8) }],
  });
  const zoneVulnerability = k.status({
    id: "e1-zone-dmg-taken",
    origin: "e1",
    debuff: true,
    modifiers: [{ stat: "vulnerability", value: k.rankParam(1, 2) }],
  });
  const e6Merrymake = k.status({
    id: "e6-enhanced-basic-merrymake",
    origin: "e6",
    modifiers: [{ stat: "merrymaking", value: k.rankParam(6, 2) }],
  });

  const syncMmr = (ctx: BattleApi) => {
    const mmr = ctx.self.counter(MMR);
    if (mmr <= 1e-9) {
      ctx.removeStatus(ctx.self, mmrCritRate);
      ctx.removeStatus(ctx.self, mmrCritDmg);
      return;
    }
    if (ctx.self.has(mmrCritRate)) {
      ctx.setStatusStacks(ctx.self, mmrCritRate, mmr);
    } else {
      ctx.applyStatus(ctx.self, mmrCritRate, { setStacks: mmr });
    }
    if (!ctx.self.has(mmrCritDmg)) ctx.applyStatus(ctx.self, mmrCritDmg);
  };

  /** E2: every 120 Hidden MMR gained in Godmode is 1 extra turn and use. */
  const grantE2 = (ctx: BattleApi) => {
    const step = k.rankParam(2, 1);
    while (ctx.self.counter(E2_PROGRESS) >= step - 1e-9) {
      ctx.setCounter(
        ctx.self,
        E2_PROGRESS,
        ctx.self.counter(E2_PROGRESS) - step
      );
      ctx.grantExtraTurn(ctx.self);
      ctx.setCounter(ctx.self, USES, ctx.self.counter(USES) + 1);
    }
  };

  const gainMmr = (ctx: BattleApi, amount: number) => {
    const before = ctx.self.counter(MMR);
    ctx.addCounter(ctx.self, MMR, amount, mmrMax);
    const gained = ctx.self.counter(MMR) - before;
    syncMmr(ctx);
    if (!k.e(2) || gained <= 0 || !ctx.self.has(godmode)) return;
    ctx.setCounter(
      ctx.self,
      E2_PROGRESS,
      ctx.self.counter(E2_PROGRESS) + gained
    );
    // Partial (chance-weighted) gains are granted at the next whole one or
    // at the end of an Enhanced Basic ATK.
    if (ctx.weight >= 1 - 1e-9) grantE2(ctx);
  };

  k.on(
    "teamResourceChanged",
    "talent",
    {
      subject: "any",
      resource: PUNCHLINE,
      when: (event) => (event.delta ?? 0) > 0,
    },
    (ctx, event) => gainMmr(ctx, (event.delta ?? 0) / ctx.weight)
  );

  /**
   * Top Loot Box. Its random effect is one of three, taken in expectation:
   * True DMG of 20% of this DMG (folded into the multiplier), 2 Skill
   * Points, or 3 Punchline.
   */
  const lootBox = (ctx: BattleApi, weight: number) => {
    const sword = 1 + k.param("03", 5) / 3;
    ctx.deal(
      {
        shape: "split",
        main: k.param("03", 3) * sword,
        kind: "elation",
        punchline: ctx.self.certifiedBanger(),
      },
      {
        abilityId: "topLootBox",
        abilityKind: "other",
        origin: "ultimate",
        weight,
      }
    );
    ctx.gainSkillPoints((k.param("03", 7) * weight) / 3);
    ctx.addTeamResource(PUNCHLINE, (k.param("03", 6) * weight) / 3);
  };

  // Ultimate Zone: each Skill Point an ally consumes may open a Top Loot Box.
  // The chance is tracked as its expected value (mean field).
  k.on(
    "skillPointsChanged",
    "ultimate",
    {
      subject: "ally",
      when: (event, self) =>
        (event.delta ?? 0) < 0 &&
        self.has(godmode) &&
        self.certifiedBanger() > 0,
    },
    (ctx, event) => {
      let remaining = -(event.delta ?? 0);
      while (remaining > 1e-9) {
        const portion = Math.min(1, remaining);
        remaining -= portion;
        const chance = ctx.self.counter(CHANCE);
        if (chance <= 1e-9) break;
        lootBox(ctx, portion * chance);
        ctx.setCounter(
          ctx.self,
          CHANCE,
          chance * (1 - portion * chance * (1 - k.param("03", 4)))
        );
      }
    }
  );

  /** Talent: Elation DMG to the attacked targets while holding Certified Banger. */
  const bangerHit = (ctx: BattleApi, shape: "single" | "aoe"): HitDef[] => {
    const banger = ctx.self.certifiedBanger();
    if (banger <= 0) return [];
    const multiplier = k.param("04", 3);
    return [
      {
        shape,
        main: multiplier,
        each: multiplier,
        kind: "elation",
        punchline: banger,
      },
    ];
  };

  // Facts: none of Silver Wolf LV.999's abilities regenerate Energy.
  k.ability({
    id: "basic",
    kind: "basic",
    energy: 0,
    hits: (ctx) => [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
      ...bangerHit(ctx, "single"),
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    energy: 0,
    before: (ctx) => ctx.addTeamResource(PUNCHLINE, k.param("02", 2)),
    hits: (ctx) => [
      { shape: "aoe", each: k.param("02", 1), toughness: { each: 10 } },
      ...bangerHit(ctx, "aoe"),
    ],
  });

  const exitGodmode = (ctx: BattleApi) => {
    ctx.removeStatus(ctx.self, godmode);
    if (k.e(1)) {
      for (const enemy of ctx.enemies)
        ctx.removeStatus(enemy, zoneVulnerability);
    }
    const kept = k.e(1) ? ctx.self.counter(MMR) * k.rankParam(1, 1) : 0;
    ctx.setCounter(ctx.self, MMR, kept);
    ctx.setCounter(ctx.self, E2_PROGRESS, 0);
    ctx.setCounter(ctx.self, USES, 0);
    syncMmr(ctx);
  };

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "self",
    energy: 0,
    // Hidden MMR, not Energy, unlocks the Ultimate, and it is not consumed.
    energyCost: 0,
    usable: (view) =>
      !view.self.has(godmode) && view.self.counter(MMR) >= mmrThreshold - 1e-9,
    after: (ctx) => {
      ctx.applyStatus(ctx.self, godmode);
      ctx.setCounter(ctx.self, USES, k.param("04", 5));
      // Assumption: each new Zone starts at the initial 100% chance.
      ctx.setCounter(ctx.self, CHANCE, 1);
      if (k.e(1)) {
        for (const enemy of ctx.enemies) {
          ctx.applyStatus(enemy, zoneVulnerability);
        }
      }
      // E2 counts the initial Hidden MMR.
      if (k.e(2)) ctx.setCounter(ctx.self, E2_PROGRESS, ctx.self.counter(MMR));
      if (k.a(3)) gainMmr(ctx, k.traceParam(3, 1));
      if (k.e(2)) grantE2(ctx);
      ctx.advanceAction(ctx.self, 1);
    },
  });

  const enhancedBounces = k.param("08", 3);
  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    energy: 0,
    // "Enhanced Basic ATK cannot recover Skill Points."
    skillPoints: 0,
    usable: (view) => view.self.has(godmode),
    before: (ctx) => {
      const stacks = Math.min(
        k.param("08", 7),
        Math.floor(ctx.self.counter(MMR) / k.param("08", 6) + 1e-9)
      );
      if (stacks > 0) {
        ctx.applyStatus(ctx.self, enhancedBoost, { setStacks: stacks });
      }
      if (k.e(6)) ctx.applyStatus(ctx.self, e6Merrymake);
    },
    hits: (ctx) => {
      const banger = ctx.self.certifiedBanger();
      // With Certified Banger the ability DMG becomes Elation DMG.
      const elation: Partial<HitDef> =
        banger > 0 ? { kind: "elation", punchline: banger } : {};
      return [
        // Facts give 10 Toughness to the bounces and 10 to the Final Hit;
        // read as 10 in total over the 100 bounces.
        {
          shape: "bounce",
          each: k.param("08", 1) / enhancedBounces,
          bounces: enhancedBounces,
          toughness: { each: 10 / enhancedBounces },
          ...elation,
        },
        {
          shape: "split",
          main: k.param("08", 4),
          toughness: { each: 10 },
          ...elation,
        },
        // An Enhanced Basic ATK is a Basic ATK for the Talent's Elation DMG.
        ...bangerHit(ctx, "aoe"),
      ];
    },
    afterHit: (ctx, index) => {
      if (index !== 0) return;
      for (let box = 0; box < k.param("08", 5); box += 1) lootBox(ctx, 1);
    },
    after: (ctx) => {
      ctx.removeStatus(ctx.self, enhancedBoost);
      if (k.e(6)) ctx.removeStatus(ctx.self, e6Merrymake);
      if (k.e(2)) grantE2(ctx);
      ctx.setCounter(ctx.self, USES, ctx.self.counter(USES) - 1);
      if (ctx.self.counter(USES) < 1 - 1e-6) exitGodmode(ctx);
    },
  });

  // One ID for both variants, since the Aha Instant always uses
  // "elationSkill". Only the Godmode variant deals DMG; the ability is not
  // flagged as an attack (tracked: silver-wolf-lv999-elation-attack).
  k.ability({
    id: "elationSkill",
    kind: "elationSkill",
    energy: 0,
    attack: false,
    before: (ctx) => {
      const punchline = ctx.teamResource(PUNCHLINE);
      if (!ctx.self.has(godmode)) gainMmr(ctx, k.param("20", 1));
      if (k.a(2) && punchline >= k.traceParam(2, 1) - 1e-9) {
        gainMmr(ctx, k.traceParam(2, 3));
      }
      if (k.a(2) && punchline >= k.traceParam(2, 2) - 1e-9) {
        gainMmr(ctx, k.traceParam(2, 4));
      }
      ctx.scratch.set("demo", ctx.self.has(godmode));
    },
    hits: (ctx) => {
      if (!ctx.scratch.get("demo")) return [];
      // E4: the original Punchline plus 5 times it.
      const punchline = k.e(4)
        ? { punchline: ctx.teamResource(PUNCHLINE) * (1 + k.rankParam(4, 1)) }
        : {};
      return [
        {
          shape: "bounce",
          each: k.param("21", 1),
          bounces: k.param("21", 2),
          kind: "elation",
          toughness: { each: 10 },
          ...punchline,
        },
      ];
    },
    after: (ctx) => {
      if (ctx.scratch.get("demo")) ctx.setCounter(ctx.self, CHANCE, 1);
    },
  });

  if (k.e(6)) {
    // Absolute Weakness: every Weakness, Base RES 0, and RES −20% for Types
    // the enemy was already weak to.
    const types = Object.keys(DMG_BOOST_STAT_BY_COMBAT_TYPE) as CombatTypeId[];
    const resDown = new Map(
      types.map((type) => [
        type,
        k.status({
          id: `absolute-weakness-${type}`,
          origin: "e6",
          modifiers: [
            {
              stat: "resReduction",
              value: k.rankParam(6, 1),
              filter: { combatTypes: [type] },
            },
          ],
        }),
      ])
    );
    k.on("battleStart", "e6", { subject: "any" }, (ctx) => {
      for (const enemy of ctx.enemies) {
        for (const type of types) {
          const status = resDown.get(type);
          if (!enemy.weaknesses.has(type)) ctx.implantWeakness(enemy, type);
          else if (status) ctx.applyStatus(enemy, status);
        }
      }
    });
  }

  // Godmode: Enhanced Basic ATK until its uses run out.
  k.policy({
    turn: (view) =>
      view.self.has(godmode)
        ? "enhancedBasic"
        : view.skillPoints >= 1
          ? "skill"
          : "basic",
  });
});
