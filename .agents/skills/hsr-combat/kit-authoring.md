# Kit authoring

Kits translate one catalog entity into combat behaviour. They live in
`src/domain/combat/impl/`, one file per entity:

| Entity | File | Factory |
|---|---|---|
| Character | `characters/<id>-<slug>.ts` | `defineCharacter(id, (k) => ...)` |
| Light Cone | `lightCones/<id>-<slug>.ts` | `defineLightCone(id, (k) => ...)` |
| Relic set | `relicSets/<id>-<slug>.ts` | `defineRelicSet(id, { twoPiece, fourPiece })` |

- The file default-exports the definition. Its numeric prefix must equal the ID;
  `src/lib/combat/kits.ts` discovers files automatically and checks this.
- The dossier prints the expected path.
- Trailblazer variants use the canonical (Caelus) ID: 8001, 8003, 8005, 8007,
  8009. Parameters resolve against the account's actual variant.

Reference implementations to imitate:

- `characters/1102-seele.ts`: self buffs, stacking, options, Eidolon riders.
- `characters/1309-robin.ts`: team statuses, a countdown summon, leaving the
  Action Order, Additional DMG on ally attacks.
- `characters/1005-kafka.ts`: debuff DoTs with base chance, detonation,
  follow-ups queued from teammates' actions.
- `lightCones/23001-in-the-night.ts`: SPD-threshold stepped scaling.
- `relicSets/115-the-ashblazing-grand-duke.ts`: per-hit stacking with reset.
- `relicSets/309-rutilant-arena.ts`: stat-threshold bonus.
- `relicSets/108-genius-of-brilliant-stars.ts`: target-weakness filter.

## Builder (`k`)

Shared by all entities (`KitBuilder`):

| Call | Meaning |
|---|---|
| `k.stat(origin, modifier)` | permanent modifier on the owner/wearer |
| `k.teamStat(origin, modifier, scope?, { combatTypes?, paths? })` | permanent modifier on every ally (`"allies"`) or every other ally |
| `k.status(def)` | declare a status; returns the definition to apply later |
| `k.on(event, origin, filter, handler)` | react to battle events |
| `k.toggle(id, origin, condition, default, threshold?)` | user condition (U8) |
| `k.count(id, origin, condition, default, max)` | user count (U8) |
| `k.countPath(pathId)`, `k.countCombatType(type)`, `k.team` | team composition |

Characters (`CharacterKitBuilder`) add:

| Call | Meaning |
|---|---|
| `k.param(skillId, n)` | `#n` of a skill at its effective level; `skillId` can be the suffix (`"02"`) or a full/servant ID |
| `k.traceParam(a, n)` | `#n` of Bonus Ability `a` (1 = A2, 2 = A4, 3 = A6) |
| `k.rankParam(e, n)` | `#n` of Eidolon `e` |
| `k.e(n)` / `k.a(n)` | Eidolon reached / Bonus Ability unlocked |
| `k.ability(def)` | an action (see below) |
| `k.memosprite(def)` / `k.summon(def)` | memosprite / stat-less countdown units |
| `k.policy({ turn, ultimate })` | play pattern overrides |
| `k.startingEnergy(fraction)` | default 0.5 |

Light Cones (`k.s(n)`, `k.superimposition`, `k.wearer`) and Relic sets
(`k.param(n)`, `k.pieces`, `k.wearer`) read their own parameters.

`origin` labels: `basic`, `skill`, `ultimate`, `talent`, `technique`,
`memospriteSkill`, `memospriteTalent`, `elationSkill`, `a2`, `a4`, `a6`,
`e1`…`e6`, `lightCone`, `relic2pc`, `relic4pc`, `ornament`.

## Modifiers

```ts
{ stat, value?, scaling?, filter? }
filter: {
  tags?, combatTypes?, attackerKinds?,
  // Target state when the hit landed:
  targetWeakness?, targetStatuses?: ["status-id"], targetFamilies?: ["burn"],
  minTargetDebuffs?, targetBroken?, targetRoles?: ["main" | "adjacent" | "each"],
}
scaling: { source: "holder" | "applier", stat, ratio, threshold?, step?, cap?, atLeast? }
```

On a stacking status, `value` and `scaling.ratio` are per stack. Stat keys and
zones are listed in `translator-rules.md` U2.

"Deals X% more DMG to Burned enemies" is `filter: { targetFamilies: ["burn"] }`;
"to enemies with Y" is `targetStatuses: [y.id]`; "to the target" (not the
adjacent ones) is `targetRoles: ["main"]`. Do not apply and remove self
statuses around hits to emulate these. Target filters see whether a status is
present, not its landing chance.

Incoming modifiers (`vulnerability`, `defReduction`, `resReduction`,
`dmgMitigation`) on enemy-held statuses may use `scaling` with
`source: "applier"` ("DMG taken +2% per 100 ATK of the applier").

## Statuses

```ts
const s = k.status({
  id: "amplification",            // unique within the kit
  origin: "talent",
  duration: { turns: 2, countdown?: "turnStart", clock?: "applier" },
  maxStacks: 3,
  modifiers: [{ stat: "dmgBoost", value: 0.8 }],
  debuff: true,                   // enemy-held
  unique: true,                   // copies from other appliers do not stack
  family: "shock",                // burn | shock | bleed | windShear | frozen | entanglement | imprisonment | slow
  skipsTurn: true,                // control: the holder skips its turn (with base chance: in expectation)
  dot: { hit: { shape: "single", main: 2.9, kind: "dot" } },
});
ctx.applyStatus(unit, s, { stacks?, setStacks?, turns?, baseChance? });
ctx.setStatusStacks(unit, s, n);   // sync stacks: no new application, chance and duration kept
ctx.removeStatus(unit, s); ctx.consumeStacks(unit, s, n);
unit.has(s); unit.stacks(s); unit.hasFamily("burn"); unit.debuffCount();
```

- Give every status the game names generically a `family`. Weakness Break
  statuses carry their families, so "Burned" checks see Break Burn too.
- Re-applying a debuff without `baseChance` makes it certain. To change
  stacks of an existing debuff use `setStatusStacks`.
- SPD modifiers on statuses change turn order, including stat-scaled ones
  ("SPD +20% of Hanya's SPD": `spdFlat` with `scaling`). On enemy statuses
  (Slow, Imprisonment) a debuff with a base chance counts with that chance.

## Abilities and hits

```ts
k.ability({
  id: "skill", kind: "skill",            // basic | skill | ultimate | followUp | memospriteSkill | elationSkill | talent | other
  target?: "enemy" | "ally" | "self" | "allies" | "none",
  hits: [{ shape: "blast", main: k.param("02", 1), adjacent: k.param("02", 3),
           toughness: { main: 20, adjacent: 10 } }],
  // or hits computed after `before` from battle state:
  // hits: (ctx) => [{ shape: "bounce", each: 0.5, bounces: 3 + ctx.self.stacks(charge) }],
  attack?: boolean,                       // default: has hits
  tags?: ["ultimate"],                    // added to the kind's default tags
  onlyTags?: [],                          // replaces them ("not considered Skill DMG")
  energy?, skillPoints?, energyCost?,
  resource?: { counter, amount },         // Ultimate paid from a counter, not Energy
  castOutsideActionOrder?: boolean,       // Ultimate usable while Departed
  endsTurn?: false,                       // "does not end the turn": the turn continues
  usable?: (view) => boolean,             // turn abilities: falls back to Basic ATK when false
  before?: (ctx) => { ... },              // before hits
  afterHit?: (ctx, index) => { ... },     // after each HitDef ("after each hit")
  after?: (ctx) => { ... },               // after hits
});
```

`HitDef`:

```ts
{
  shape,                                  // single | blast | aoe | bounce | split
  main?, adjacent?, each?, bounces?,
  stat?, statOwner?, kind?, tags?, onlyTags?, combatType?,
  toughness?, toughnessWithoutWeakness?, critOverride?, elationScaling?,
  punchline?, silent?,
}
```

- `kind` is one of `direct`, `dot`, `break`, `superBreak`, `elation`, `fixed`.
- `aoe` with both `main` and `each`: the designated target takes `main`, the
  others `each`.
- `split`: "X% distributed evenly across all enemies"; `main` is the total.
- `toughnessWithoutWeakness`: fraction of Toughness reduced on enemies
  without the matching Weakness (1 for "regardless of Weakness Type").
- `silent`: no `hit` event. Use it for the second part of a two-stat hit
  ("ATK% + Max HP%") so per-hit effects trigger once.
- An action's `ctx.scratch` (a `Map`) carries values from `before` to
  `afterHit` and `after`. `ctx.targetsHit()` lists the enemies hit so far.
- Ultimate variants: declare each as its own `kind: "ultimate"` ability and
  return its ID from the Ultimate policy.

## Battle API (`ctx`)

```ts
ctx.self / ctx.allies / ctx.enemies / ctx.target / ctx.mainTarget / ctx.weight
ctx.skillPoints / ctx.maxSkillPoints / ctx.cycle / ctx.time          // live values
ctx.applyStatus / setStatusStacks / removeStatus / consumeStacks
ctx.gainEnergy(unit, n, { fixed? }) → overflow / setEnergy / gainSkillPoints(n) / setMaxSkillPoints(n)
ctx.advanceAction(unit, f) / delayAction / grantExtraTurn(unit) / setInActionOrder(unit, b)
ctx.queueAction(unit, abilityId, { target?, weight? })   // follow-ups after the current action
ctx.deal(hit, { targets?, tags?, attacker?, abilityId?, abilityKind?, origin?, weight? })
ctx.detonateDots(enemy, ratio, { filter? })
ctx.reduceToughness(enemy, n, { withoutWeakness?, fixed?, combatType?, origin?, abilityId? })
ctx.implantWeakness(enemy, type, { turns? }) / removeWeakness(enemy, type)
ctx.addCounter(unit, name, d, max?) / setCounter / unit.counter(name)
ctx.teamResource(name) / addTeamResource(name, d, max?)    // "punchline"
ctx.summon(owner, servantId) / findSummon(owner, servantId) / dismiss(unit)
ctx.grantCertifiedBanger(unit, value, turns?) / unit.certifiedBanger()
unit.pathId / unit.slot / unit.actionGauge / unit.speed
isEnemy(view)                                               // narrow event targets
```

- `deal` inside an ability's callbacks is credited to that ability (its row
  in the breakdown) unless you pass `origin` or `abilityId`. Elsewhere it is
  `<origin>:<Character ID>`; pass `abilityId` to name the row.
- `findSummon` returns an active summon without restarting its gauge;
  `summon` on an existing countdown restarts it.
- Summons' attacks count as their owner's for `subject: "self"` listeners
  (Lightning-Lord's hits are Jing Yuan's Follow-up ATK DMG).

## Events

`k.on(event, origin, filter, handler)`, where `filter` is
`{ subject?, abilityKinds?, tags?, attack?, status?, resource?, when?, limitPerTurn?, limitPerAction?, limitPerOwnTurn? }`.

`subject` is relative to the kit's unit: `self` (default), `selfOrMemosprite`,
`memosprite`, `ally`, `otherAlly`, `enemy`, `any`.

| Event | `unit` | Notes |
|---|---|---|
| `battleStart` | first ally | use `subject: "any"` |
| `turnStart` / `turnEnd` | acting unit | extra turns included |
| `actionStart` / `actionEnd` | acting unit | `abilityId`, `abilityKind`, `tags`, `target`, `attack`; `actionEnd` adds `targetsHit` |
| `hit` | attacker | once per damage instance and target |
| `weaknessBreak` | breaker | `target` is the enemy |
| `enemyAttack` / `hitByEnemy` | enemy / ally hit | `weight` is the aggro share |
| `statusApplied` | applier | `target`, `status` |
| `dotTick` | enemy | `status`; `detonation` tells detonations from turn-start ticks |
| `teamResourceChanged` | changer | `resource`, `delta` |
| `skillPointsChanged` | unit that caused it | `delta` (+ gained, − spent), after the cap |
| `ahaInstantStart` / `ahaInstantEnd` | Aha | Elation |

"After X attacks" → `actionEnd` with `attack: true`. "When X uses" →
`actionStart`. "Once per turn" → `limitPerTurn: 1` (resets at every unit's
turn); "once per <Character>'s turn" → `limitPerOwnTurn: 1`. Put further
conditions in `when: (event, self) => boolean` rather than returning early
from the handler: `when` runs before limits, so an event that does not
qualify does not use up "once per turn". `turnStart`/`turnEnd` carry
`extraTurn`.

### Weights

Handlers and abilities run with `ctx.weight`, the expected occurrences of the
trigger (an aggro share, a 60% chance, a queued branch).

- Scaled by the API: Energy, Skill Points, counters (`addCounter`), action
  advance/delay, `deal`, `detonateDots`, Toughness, team resources, queued
  actions, and extra turns (accumulated until a whole turn is due).
- Limits count weight: two 60% branches of one turn use 1.0 of
  `limitPerTurn: 1`, and the second is scaled to the remaining 0.4.
- Not scaled: `applyStatus` stacks and `setCounter`. For a chance-based buff,
  pass `stacks: ctx.weight` (or a base chance for enemy debuffs).
- Threshold checks ("at 150 Charge") run fine under fractional weights: the
  counter holds the expected value.

## Policies

```ts
k.policy({
  turn: (view) => (view.self.has(enhanced) ? "enhancedBasic" : view.skillPoints >= 1 ? "skill" : "basic"),
  ultimate: (view) => !view.self.has(enhanced),
});
```

`view` gives you `self`, `allies`, `enemies`, `mainTarget`, `skillPoints`,
`maxSkillPoints`, `cycle`, `time`, `upcoming` (the unit about to act when
Ultimates are checked before a turn), `extraTurn`, `usedThisTurn` (abilities
already used in a turn that did not end), and `teamResource(name)`.

- A turn policy may return `{ ability, target }` to aim an ally ability at a
  specific ally (`ctx.target` is that ally).
- An Ultimate policy may return an ability ID to cast an Ultimate variant.

### What timelines may depend on

The optimizer caches timelines and re-scores Relics without re-simulating.
Reading any stat with `unit.panelStat(...)` in a policy or handler is fine:
the engine records the read and the optimizer keys its cache on that stat.
Do not read stats any other way (e.g. by caching a panel value in a closure
at build time).

## Checking your work

```bash
npm run combat:dossier -- C 1102          # text, IDs, facts, current kit, tracker
KIT_FILES=src/domain/combat/impl/characters/1102-seele.ts \
  npx vitest run tests/combat/kit-check.test.ts --reporter=verbose --disableConsoleIntercept
npx vitest run tests/combat               # registry health + reference tests
npx tsc -p tsconfig.app.json --noEmit
```

To inspect a timeline in a scratch test, call
`formatTimeline(result.log)` from `src/domain/combat/debug/timeline.ts` and
read `result.report.abilities`.
