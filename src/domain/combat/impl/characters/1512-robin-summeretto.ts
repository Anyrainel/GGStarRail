import type { BattleApi, BattleEvent, UnitView } from "../../kit/api";
import { defineCharacter } from "../../kit/character";
import type { StatusDef } from "../../kit/model";

/** Robin • Summeretto — Remembrance, Wind. */
export default defineCharacter("1512", (k) => {
  const SONGBIRDS = "11512";
  const COUNTDOWN = "fever-countdown";
  const VIBES = "vibes";
  // "Summer Songbirds" members on stage (Bessie, Drummie, Paddie).
  const MEMBERS = "songbird-members";
  // E6: Energy beyond the cap kept for a second Ultimate during Fever.
  const STORED = "stored-energy";
  const FEVER_ENTERED = "fever-entered";
  // A4: Groove stacks.
  const GROOVE = "groove";
  // Expected share already used of the current turn's first Vibes gain
  // (A4), first ability-driven Vibes gain (E2), and first healing or Shield
  // provided (Talent).
  const FIRST_GAIN = "first-vibes-gain";
  const FIRST_ABILITY_GAIN = "first-ability-vibes-gain";
  const FIRST_SUPPORT = "first-support";
  const supportPaths = new Set(["Shaman", "Priest", "Knight"]);
  // Remembrance supports (Hyacine, Cyrene, Trailblazer).
  const supportIds = new Set(["1409", "1415", "8007"]);

  const songbirdHp = k.param("04", 1);
  const vibesCap = k.param("04", 5) + (k.e(2) ? k.rankParam(2, 1) : 0);

  const fever = k.status({ id: "fever", origin: "talent" });
  const feverDmg = k.status({
    id: "fever-dmg",
    origin: "memospriteTalent",
    modifiers: [{ stat: "dmgBoost", value: k.param("1151203", 1) }],
  });
  // Vibes-scaled parts: stacks follow the current Vibes.
  const feverDmgVibes = k.status({
    id: "fever-dmg-vibes",
    origin: "memospriteTalent",
    maxStacks: vibesCap,
    modifiers: [{ stat: "dmgBoost", value: k.param("1151203", 2) }],
  });
  const zone = k.status({
    id: "fever-zone",
    origin: "talent",
    modifiers: [{ stat: "defIgnore", value: k.param("04", 8) }],
  });
  const zoneVibes = k.status({
    id: "fever-zone-vibes",
    origin: "talent",
    maxStacks: vibesCap,
    modifiers: [{ stat: "defIgnore", value: k.param("04", 9) }],
  });
  // DMG taken by enemies with 1/2/3 members on stage.
  const stageVulnerability: StatusDef[] = [3, 4, 5].map((index) =>
    k.status({
      id: `songbirds-vulnerability-${index - 2}`,
      origin: "memospriteTalent",
      debuff: true,
      modifiers: [{ stat: "vulnerability", value: k.param("1151203", index) }],
    })
  );
  // "This lasts for 2 turn(s), and its duration decreases by 1 at the start
  // of this character's turn."
  const guest = k.status({
    id: "special-guest",
    origin: "ultimate",
    duration: { turns: 2, countdown: "turnStart" },
  });
  // A2 reads the Vibes at the time it is granted (snapshot).
  const a2Turns = k.traceParam(1, 5);
  const a2Atk = k.status({
    id: "deviated-chords-atk",
    origin: "a2",
    duration: { turns: a2Turns },
    modifiers: [
      {
        stat: "atkFlat",
        scaling: { source: "applier", stat: "hp", ratio: k.traceParam(1, 1) },
      },
    ],
  });
  const a2AtkVibes = k.status({
    id: "deviated-chords-atk-vibes",
    origin: "a2",
    duration: { turns: a2Turns },
    maxStacks: vibesCap,
    modifiers: [
      {
        stat: "atkFlat",
        scaling: { source: "applier", stat: "hp", ratio: k.traceParam(1, 2) },
      },
    ],
  });
  const a2CritDmg = k.status({
    id: "deviated-chords-cd",
    origin: "a2",
    duration: { turns: a2Turns },
    modifiers: [{ stat: "critDmg", value: k.traceParam(1, 3) }],
  });
  const a2CritDmgVibes = k.status({
    id: "deviated-chords-cd-vibes",
    origin: "a2",
    duration: { turns: a2Turns },
    maxStacks: vibesCap,
    modifiers: [{ stat: "critDmg", value: k.traceParam(1, 4) }],
  });
  // Stacks hold the SPD% ratio set at Fever entry.
  const e4Speed = k.status({
    id: "e4-songbird-spd",
    origin: "e4",
    maxStacks: 10_000,
    modifiers: [{ stat: "spdPct", value: 1 }],
  });

  if (k.a(3)) k.stat("a6", { stat: "critRate", value: k.traceParam(3, 1) });
  if (k.e(2)) k.teamStat("e2", { stat: "resPen", value: k.rankParam(2, 3) });
  // E6: "Increases the Memosprite Skill's DMG multiplier by 100% of its
  // original value" (Robin's conditional modifiers reach the Songbirds).
  if (k.e(6)) {
    k.stat("e6", {
      stat: "dmgMultiplier",
      value: k.rankParam(6, 1),
      filter: { tags: ["memosprite"] },
    });
  }

  const findSongbirds = (ctx: BattleApi, robin: UnitView) =>
    ctx.findSummon(robin, SONGBIRDS);
  const isSongbirds = (unit: UnitView, robin: UnitView) =>
    unit.owner === robin && unit.definitionId === SONGBIRDS;

  // E6: Energy beyond the cap from any source is kept during Fever for a
  // second Ultimate.
  if (k.e(6)) {
    k.on(
      "energyGained",
      "e6",
      {
        when: (event, self) => self.has(fever) && (event.overflow ?? 0) > 0,
      },
      (ctx, event) =>
        ctx.addCounter(
          ctx.self,
          STORED,
          event.overflow ?? 0,
          ctx.self.maxEnergy
        )
    );
  }

  /**
   * Share of this (possibly weighted) trigger that is the first of its kind
   * in the current turn; records it.
   */
  const firstInTurn = (ctx: BattleApi, robin: UnitView, name: string) => {
    const left = 1 - robin.counter(name);
    if (left <= 1e-9 || ctx.weight <= 0) return 0;
    const share = Math.min(1, left / ctx.weight);
    ctx.addCounter(robin, name, share);
    return share;
  };
  k.on("turnStart", "talent", { subject: "any" }, (ctx) => {
    for (const name of [FIRST_GAIN, FIRST_ABILITY_GAIN, FIRST_SUPPORT]) {
      if (ctx.self.counter(name) > 0) ctx.setCounter(ctx.self, name, 0);
    }
  });

  const syncVibes = (ctx: BattleApi, robin: UnitView) => {
    const vibes = robin.counter(VIBES);
    for (const ally of ctx.allies) {
      if (ally.has(zoneVibes)) ctx.setStatusStacks(ally, zoneVibes, vibes);
      if (ally.has(feverDmgVibes)) {
        ctx.setStatusStacks(ally, feverDmgVibes, vibes);
      }
    }
  };

  const spreadZone = (ctx: BattleApi, robin: UnitView) => {
    if (!robin.has(fever)) return;
    const vibes = robin.counter(VIBES);
    for (const ally of ctx.allies) {
      if (ally.kind === "summon" || ally.has(zone)) continue;
      ctx.applyStatus(ally, zone);
      ctx.applyStatus(ally, zoneVibes, { setStacks: vibes });
    }
  };

  const setMembers = (ctx: BattleApi, robin: UnitView, members: number) => {
    ctx.setCounter(robin, MEMBERS, members);
    stageVulnerability.forEach((status, index) => {
      for (const enemy of ctx.enemies) {
        if (index === members - 1) ctx.applyStatus(enemy, status);
        else ctx.removeStatus(enemy, status);
      }
    });
  };

  const startFever = (ctx: BattleApi, robin: UnitView) => {
    const songbirds = findSongbirds(ctx, robin);
    if (!songbirds || robin.has(fever)) return;
    ctx.applyStatus(robin, fever);
    if (k.e(4)) ctx.addCounter(robin, VIBES, k.rankParam(4, 1), vibesCap);
    const vibes = robin.counter(VIBES);
    for (const unit of [robin, songbirds]) {
      ctx.applyStatus(unit, feverDmg);
      ctx.applyStatus(unit, feverDmgVibes, { setStacks: vibes });
    }
    spreadZone(ctx, robin);
    syncVibes(ctx, robin);
    // The Songbirds and the countdown join the Action Order; Robin leaves
    // it until Fever ends.
    ctx.setInActionOrder(songbirds, true);
    ctx.summon(robin, COUNTDOWN);
    ctx.setInActionOrder(robin, false);
    if (k.e(4)) {
      const ratio = k.rankParam(4, 2) + vibes * k.rankParam(4, 3);
      ctx.applyStatus(songbirds, e4Speed, { setStacks: ratio });
    }
    if (k.e(6) && robin.counter(FEVER_ENTERED) === 0) {
      ctx.gainEnergy(robin, k.rankParam(6, 2), { fixed: true });
    }
    ctx.setCounter(robin, FEVER_ENTERED, 1);
  };

  const checkStage = (ctx: BattleApi, robin: UnitView) => {
    if (!findSongbirds(ctx, robin)) return;
    const vibes = robin.counter(VIBES);
    const members = robin.counter(MEMBERS);
    let next = members;
    if (vibes + 1e-9 >= k.param("04", 6)) next = Math.max(next, 2);
    if (vibes + 1e-9 >= k.param("04", 7)) next = 3;
    if (next !== members) setMembers(ctx, robin, next);
    if (next >= 3) startFever(ctx, robin);
  };

  /**
   * Vibes from `source`. `ability`: an ally target used an ability to cause
   * it (E2's first-per-turn bonus).
   */
  const gainVibes = (
    ctx: BattleApi,
    robin: UnitView,
    amount: number,
    source: UnitView | null,
    ability = false
  ) => {
    let gained = amount;
    if (k.e(2) && ability) {
      gained += k.rankParam(2, 2) * firstInTurn(ctx, robin, FIRST_ABILITY_GAIN);
    }
    ctx.addCounter(robin, VIBES, gained, vibesCap);
    // A4: the first Vibes gain in a turn spends 1 Groove for fixed Energy.
    if (k.a(2)) {
      const first = firstInTurn(ctx, robin, FIRST_GAIN);
      const spent = first * Math.min(1, robin.counter(GROOVE));
      if (spent > 1e-9) {
        ctx.addCounter(robin, GROOVE, -spent);
        ctx.gainEnergy(robin, k.traceParam(2, 2) * spent, { fixed: true });
      }
    }
    if (k.a(1) && source && source.kind !== "summon") {
      const vibes = robin.counter(VIBES);
      if (source.panelStat("atk") > robin.panelStat("atk")) {
        ctx.applyStatus(source, a2Atk);
        ctx.applyStatus(source, a2AtkVibes, { setStacks: vibes });
      } else {
        ctx.applyStatus(source, a2CritDmg);
        ctx.applyStatus(source, a2CritDmgVibes, { setStacks: vibes });
      }
    }
    syncVibes(ctx, robin);
    checkStage(ctx, robin);
  };

  const endFever = (ctx: BattleApi, robin: UnitView) => {
    ctx.removeStatus(robin, fever);
    for (const ally of ctx.allies) {
      for (const status of [zone, zoneVibes, feverDmg, feverDmgVibes]) {
        ctx.removeStatus(ally, status);
      }
    }
    setMembers(ctx, robin, 0);
    ctx.setCounter(robin, VIBES, 0);
    ctx.setCounter(robin, STORED, 0);
    const songbirds = findSongbirds(ctx, robin);
    if (songbirds) ctx.dismiss(songbirds);
    const countdown = ctx.findSummon(robin, COUNTDOWN);
    if (countdown) ctx.dismiss(countdown);
    ctx.setInActionOrder(robin, true);
    // "When the Summer Songbirds disappears, Robin's action advances."
    ctx.advanceAction(robin, k.param("1151206", 1));
  };

  // Talent: Vibes when an ally target attacks, or the first time in a turn
  // that one provides healing (heals at full HP count) or a Shield.
  k.on(
    "actionStart",
    "talent",
    { subject: "ally", attack: true },
    (ctx, event) => {
      const unit = event.unit;
      const guestUnit = unit.kind === "summon" ? unit.owner : unit;
      let amount = 1;
      if (unit.has(guest) || unit.owner?.has(guest)) {
        amount += k.param("03", 2);
      }
      gainVibes(ctx, ctx.self, amount, guestUnit ?? unit, true);
    }
  );
  const provides = (ctx: BattleApi, provider: UnitView) => {
    const first = firstInTurn(ctx, ctx.self, FIRST_SUPPORT);
    if (first > 1e-9) gainVibes(ctx, ctx.self, first, provider, true);
  };
  const isShield = (event: BattleEvent) =>
    event.status?.family === "shield" &&
    event.target !== undefined &&
    event.target.kind !== "enemy";
  k.on(
    "hpChanged",
    "talent",
    {
      subject: "ally",
      when: (event) =>
        event.hpCause === "heal" &&
        event.source !== undefined &&
        event.source.kind !== "enemy",
    },
    (ctx, event) => {
      if (event.source) provides(ctx, event.source);
    }
  );
  k.on(
    "statusApplied",
    "talent",
    { subject: "ally", when: isShield },
    (ctx, event) => provides(ctx, event.unit)
  );
  // A4: Robin • Summeretto or a Summer Songbird receives healing or a Shield
  // from a teammate.
  if (k.a(2)) {
    const receiver = (unit: UnitView | undefined, self: UnitView) =>
      unit !== undefined && (unit === self || isSongbirds(unit, self));
    const groove = (ctx: BattleApi) =>
      ctx.addCounter(ctx.self, GROOVE, k.traceParam(2, 1), k.traceParam(2, 3));
    k.on(
      "hpChanged",
      "a4",
      {
        subject: "selfOrMemosprite",
        when: (event, self) =>
          event.hpCause === "heal" &&
          event.source !== undefined &&
          event.source !== self &&
          receiver(event.unit, self),
      },
      groove
    );
    k.on(
      "statusApplied",
      "a4",
      {
        subject: "otherAlly",
        when: (event, self) => isShield(event) && receiver(event.target, self),
      },
      groove
    );
  }
  // The Zone reaches memosprites summoned during Fever.
  k.on(
    "summoned",
    "talent",
    { subject: "ally", when: (event) => event.unit.kind === "memosprite" },
    (ctx) => spreadZone(ctx, ctx.self)
  );

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      {
        shape: "single",
        main: k.param("01", 1),
        stat: "hp",
        toughness: { main: 10 },
      },
    ],
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "none",
    before: (ctx) => {
      const present = findSongbirds(ctx, ctx.self);
      if (present) {
        ctx.heal(present, k.param("02", 1));
        gainVibes(ctx, ctx.self, k.param("02", 2), ctx.self, true);
        return;
      }
      // Bessie takes the stage; the Songbirds only act during Fever.
      const songbirds = ctx.summon(ctx.self, SONGBIRDS);
      ctx.setInActionOrder(songbirds, false);
      ctx.gainEnergy(ctx.self, k.param("1151205", 1));
      setMembers(ctx, ctx.self, 1);
      checkStage(ctx, ctx.self);
    },
  });

  // Special Guest: the user's choice, by default the first teammate outside
  // the support Paths and the Remembrance supports, else the first one.
  const guestMember = k.ally("special-guest", "ultimate", (candidates) =>
    candidates.find(
      (member) =>
        !supportPaths.has(member.pathId) && !supportIds.has(member.characterId)
    )
  );
  const guestUnit = (allies: readonly UnitView[]) =>
    guestMember
      ? (allies.find(
          (ally) => ally.kind === "character" && ally.slot === guestMember.slot
        ) ?? null)
      : null;

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    target: "ally",
    // Usable during Fever, while Robin is out of the Action Order.
    castOutsideActionOrder: true,
    before: (ctx) => {
      const target = ctx.target;
      if (!target || target.kind !== "character" || target === ctx.self) {
        return;
      }
      ctx.advanceAction(target, k.param("03", 1));
      ctx.gainEnergy(target, target.maxEnergy * k.param("03", 3), {
        fixed: true,
      });
      ctx.applyStatus(target, guest);
    },
    after: (ctx) => {
      const stored = ctx.self.counter(STORED);
      if (stored <= 0) return;
      ctx.setEnergy(ctx.self, ctx.self.energy + stored);
      ctx.setCounter(ctx.self, STORED, 0);
    },
  });

  k.memosprite({
    servantId: SONGBIRDS,
    speed: { ownerRatio: k.param("04", 2) },
    policy: () => "chirrup",
    abilities: [
      {
        id: "chirrup",
        kind: "memospriteSkill",
        // Facts: 20 Energy, granted below so E6 can store the overflow.
        energy: 0,
        hits: [
          {
            shape: "aoe",
            each: songbirdHp * k.param("1151201", 2),
            stat: "hp",
            toughness: { each: 10 },
          },
        ],
        after: (ctx) => {
          if (ctx.self.owner) ctx.gainEnergy(ctx.self.owner, 20);
        },
      },
    ],
  });

  // "When its turn starts, deducts 50% of the current Vibes (minimum 12)."
  k.summon({
    id: COUNTDOWN,
    countdown: true,
    speed: k.param("1151203", 9),
    policy: () => "tick",
    abilities: [
      {
        id: "tick",
        kind: "other",
        target: "none",
        before: (ctx) => {
          const robin = ctx.self.owner;
          if (!robin) return;
          if (k.e(6)) {
            ctx.gainEnergy(robin, k.rankParam(6, 2), { fixed: true });
          }
          const vibes = robin.counter(VIBES);
          const deducted = Math.max(
            k.param("1151203", 6),
            vibes * k.param("1151203", 10)
          );
          ctx.setCounter(robin, VIBES, Math.max(0, vibes - deducted));
          if (robin.counter(VIBES) <= 1e-9) endFever(ctx, robin);
          else syncVibes(ctx, robin);
        },
      },
    ],
  });

  // The Ultimate names the Special Guest so equipment sees the ally target.
  k.policy({
    ultimate: (view) => {
      const target = guestUnit(view.allies);
      return target ? { ability: "ultimate", target } : true;
    },
  });
});
