import { type ActionContext, type BattleApi, isEnemy } from "../../kit/api";
import { defineCharacter } from "../../kit/character";

/**
 * Qingque's hand as a probability distribution over tile counts per suit,
 * sorted descending ("310" = three of one suit and one of another).
 */
type Hand = Map<string, number>;

const HIDDEN_HAND = "400";
const HANDS = [
  "000",
  "100",
  "200",
  "110",
  "300",
  "210",
  "111",
  HIDDEN_HAND,
  "310",
  "220",
  "211",
] as const;
const MAX_TILES = 4;
const EPSILON = 1e-6;

function handKey(counts: number[]): string {
  return [...counts].sort((left, right) => right - left).join("");
}

function addMass(hand: Hand, key: string, mass: number): void {
  hand.set(key, (hand.get(key) ?? 0) + mass);
}

/** Removes one tile of the held suit with the fewest tiles. */
function discardFewest(counts: number[]): void {
  let index = -1;
  counts.forEach((count, suit) => {
    if (count > 0 && (index < 0 || count < (counts[index] ?? 0))) index = suit;
  });
  if (index >= 0) counts[index] = (counts[index] ?? 0) - 1;
}

/**
 * Draws one tile of a uniformly random suit. Assumption: with a full hand
 * the drawn tile joins the hand and a tile of the suit with the fewest tiles
 * is discarded, so a hand of four identical tiles is kept.
 */
function drawTile(hand: Hand): Hand {
  const next: Hand = new Map();
  for (const [key, mass] of hand) {
    if (mass <= 0) continue;
    for (let suit = 0; suit < 3; suit += 1) {
      const counts = key.split("").map(Number);
      counts[suit] = (counts[suit] ?? 0) + 1;
      if (counts.reduce((sum, count) => sum + count, 0) > MAX_TILES) {
        discardFewest(counts);
      }
      addMass(next, handKey(counts), mass / 3);
    }
  }
  return next;
}

/** Basic ATK "Flower Pick" tosses a tile of the suit with the fewest tiles. */
function tossTile(hand: Hand): Hand {
  const next: Hand = new Map();
  for (const [key, mass] of hand) {
    const counts = key.split("").map(Number);
    discardFewest(counts);
    addMass(next, handKey(counts), mass);
  }
  return next;
}

/** Qingque — Erudition, Quantum. */
export default defineCharacter("1201", (k) => {
  const handCounter = (key: string) => `qingque:hand:${key}`;
  /** Chance that this turn entered Hidden Hand (for A6). */
  const HIDDEN_CHANCE = "qingque:hidden-chance";
  const A2_USED = "qingque:a2-used";

  const readHand = (ctx: BattleApi): Hand => {
    const hand: Hand = new Map();
    let total = 0;
    for (const key of HANDS) {
      const mass = ctx.self.counter(handCounter(key));
      if (mass > 0) hand.set(key, mass);
      total += mass;
    }
    // No tiles before the first draw.
    if (total <= EPSILON) hand.set("000", 1);
    return hand;
  };
  const writeHand = (ctx: BattleApi, hand: Hand) => {
    for (const key of HANDS) {
      ctx.setCounter(ctx.self, handCounter(key), hand.get(key) ?? 0);
    }
  };

  const scoop = k.status({
    id: "a-scoop-of-moon",
    origin: "skill",
    maxStacks: k.param("02", 3),
    modifiers: [{ stat: "dmgBoost", value: k.param("02", 2) }],
  });
  const bideTime = k.status({
    id: "bide-time",
    origin: "a4",
    maxStacks: k.param("02", 3),
    modifiers: [{ stat: "dmgBoost", value: k.traceParam(2, 1) }],
  });
  const hiddenHand = k.status({
    id: "hidden-hand",
    origin: "talent",
    modifiers: [{ stat: "atkPct", value: k.param("04", 1) }],
  });
  // Applied at the expected chance of having used Enhanced Basic ATK this
  // turn: fractional stacks scale the SPD bonus.
  const winningHand = k.status({
    id: "winning-hand",
    origin: "a6",
    duration: { turns: 1 },
    modifiers: [{ stat: "spdPct", value: k.traceParam(3, 1) }],
  });

  if (k.e(1)) {
    k.stat("e1", {
      stat: "dmgBoost",
      value: k.rankParam(1, 1),
      filter: { tags: ["ultimate"] },
    });
  }

  // Talent: one draw at the start of every ally turn (her own included).
  k.on("turnStart", "talent", { subject: "ally" }, (ctx, event) => {
    if (event.unit.kind === "summon") return;
    writeHand(ctx, drawTile(readHand(ctx)));
    if (k.e(2)) ctx.gainEnergy(ctx.self, k.rankParam(2, 1));
  });

  k.on("turnEnd", "talent", {}, (ctx) => {
    ctx.removeStatus(ctx.self, scoop);
    ctx.removeStatus(ctx.self, bideTime);
    if (!k.a(3)) return;
    const chance = ctx.self.counter(HIDDEN_CHANCE);
    if (chance > EPSILON) {
      ctx.applyStatus(ctx.self, winningHand, { setStacks: chance });
    }
  });

  // E4: each Skill this turn had a fixed chance to grant Self-Sufficer; the
  // Follow-Up ATK copies the main-target DMG at that expected chance. As a
  // copy of Basic ATK DMG it keeps the Basic ATK's DMG type.
  const selfSufficer = (ctx: ActionContext, multiplier: number) => {
    if (!k.e(4) || !isEnemy(ctx.target)) return;
    const skills = ctx.self.stacks(scoop);
    const chance = 1 - (1 - k.rankParam(4, 1)) ** skills;
    if (chance <= EPSILON) return;
    ctx.deal(
      { shape: "single", main: multiplier * chance },
      {
        targets: [ctx.target],
        tags: ["basic"],
        abilityKind: "followUp",
        origin: "e4",
      }
    );
  };

  k.ability({
    id: "basic",
    kind: "basic",
    hits: [
      { shape: "single", main: k.param("01", 1), toughness: { main: 10 } },
    ],
    after: (ctx) => selfSufficer(ctx, k.param("01", 1)),
  });

  k.ability({
    id: "enhancedBasic",
    kind: "basic",
    skillPoints: 0,
    before: (ctx) => ctx.applyStatus(ctx.self, hiddenHand),
    hits: [
      {
        shape: "blast",
        main: k.param("08", 1),
        adjacent: k.param("08", 2),
        toughness: { main: 20, adjacent: 10 },
      },
    ],
    after: (ctx) => {
      selfSufficer(ctx, k.param("08", 1));
      // Hidden Hand ends after "Cherry on Top!".
      ctx.removeStatus(ctx.self, hiddenHand);
      // E6 "Recovers 1 Skill Point" has no placeholder.
      if (k.e(6)) ctx.gainSkillPoints(1);
    },
  });

  k.ability({
    id: "skill",
    kind: "skill",
    target: "self",
    energy: 0,
    before: (ctx) => {
      ctx.applyStatus(ctx.self, scoop);
      if (k.a(2)) ctx.applyStatus(ctx.self, bideTime);
      if (k.a(1) && ctx.self.counter(A2_USED) === 0) {
        ctx.gainSkillPoints(1);
        ctx.setCounter(ctx.self, A2_USED, 1);
      }
      if (k.e(2)) ctx.gainEnergy(ctx.self, k.rankParam(2, 1));
    },
  });

  k.ability({
    id: "ultimate",
    kind: "ultimate",
    hits: [{ shape: "aoe", each: k.param("03", 1), toughness: { each: 20 } }],
    after: (ctx) => writeHand(ctx, new Map([[HIDDEN_HAND, 1]])),
  });

  // The turn: Hidden Hand at turn start leads straight to "Cherry on Top!";
  // otherwise Skill (the turn does not end) until four tiles of one suit
  // enter Hidden Hand, Skill Points run out, or the DMG Boost is at its
  // stack cap, then Basic ATK. Each outcome is queued at its probability;
  // the Skill DMG stacks seen by each finisher match its branch.
  k.ability({
    id: "celestialJade",
    kind: "talent",
    target: "none",
    after: (ctx) => {
      const queue = (abilityId: string, weight: number) => {
        if (weight > EPSILON) ctx.queueAction(ctx.self, abilityId, { weight });
      };
      let hand = readHand(ctx);
      let hidden = hand.get(HIDDEN_HAND) ?? 0;
      hand.delete(HIDDEN_HAND);
      queue("enhancedBasic", hidden);
      let open = 1 - hidden;
      let skillPoints = ctx.skillPoints;
      let a2 = k.a(1) && ctx.self.counter(A2_USED) === 0;
      for (
        let skills = 0;
        open > EPSILON &&
        skills < k.param("02", 3) &&
        skillPoints >= 1 - EPSILON;
        skills += 1
      ) {
        queue("skill", open);
        skillPoints -= a2 ? 0 : 1;
        a2 = false;
        for (let draw = 0; draw < k.param("02", 1); draw += 1) {
          hand = drawTile(hand);
        }
        const reached = hand.get(HIDDEN_HAND) ?? 0;
        hand.delete(HIDDEN_HAND);
        queue("enhancedBasic", reached);
        hidden += reached;
        open -= reached;
      }
      queue("basic", open);
      // Hidden Hand consumed every tile; Basic ATK tossed one.
      hand = tossTile(hand);
      addMass(hand, "000", hidden);
      writeHand(ctx, hand);
      ctx.setCounter(ctx.self, HIDDEN_CHANCE, hidden);
    },
  });

  k.policy({ turn: () => "celestialJade" });
});
