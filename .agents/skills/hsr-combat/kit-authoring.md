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
filter: { tags?, combatTypes?, attackerKinds?, targetWeakness? }
scaling: { source: "holder" | "applier", stat, ratio, threshold?, step?, cap?, atLeast? }
```

On a stacking status, `value` and `scaling.ratio` are per stack. Stat keys and
zones are listed in `translator-rules.md` U2.

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
  dot: { hit: { shape: "single", main: 2.9, kind: "dot" } },
});
ctx.applyStatus(unit, s, { stacks?, setStacks?, turns?, baseChance? });
ctx.removeStatus(unit, s); ctx.consumeStacks(unit, s, n);
unit.has(s); unit.stacks(s);
```

## Abilities and hits

```ts
k.ability({
  id: "skill", kind: "skill",            // basic | skill | ultimate | followUp | memospriteSkill | elationSkill | talent | other
  target?: "enemy" | "ally" | "self" | "allies" | "none",
  hits: [{ shape: "blast", main: k.param("02", 1), adjacent: k.param("02", 3),
           toughness: { main: 20, adjacent: 10 } }],
  energy?, skillPoints?, energyCost?, tags?,
  usable?: (view) => boolean,
  before?: (ctx) => { ... },              // before hits
  after?: (ctx) => { ... },               // after hits
});
```

`HitDef`:

```ts
{
  shape, main?, adjacent?, each?, bounces?,
  stat?, statOwner?, kind?, tags?, onlyTags?, combatType?,
  toughness?, critOverride?, elationScaling?, punchline?,
}
```

`kind` is one of `direct`, `dot`, `break`, `superBreak`, `elation`, `fixed`.

## Battle API (`ctx`)

```ts
ctx.self / ctx.allies / ctx.enemies / ctx.target / ctx.skillPoints / ctx.cycle / ctx.weight
ctx.applyStatus / removeStatus / consumeStacks
ctx.gainEnergy(unit, n, { fixed? }) / setEnergy / gainSkillPoints(n)
ctx.advanceAction(unit, f) / delayAction / grantExtraTurn(unit) / setInActionOrder(unit, b)
ctx.queueAction(unit, abilityId, { target?, weight? })   // follow-ups after the current action
ctx.deal(hit, { targets?, tags?, attacker?, origin? })      // Additional DMG, procs, Joint ATK parts
ctx.detonateDots(enemy, ratio, { filter? })
ctx.reduceToughness(enemy, n) / implantWeakness(enemy, type)
ctx.addCounter(unit, name, d, max?) / setCounter / unit.counter(name)
ctx.teamResource(name) / addTeamResource(name, d, max?)    // "punchline"
ctx.summon(owner, servantId) / dismiss(unit)
ctx.grantCertifiedBanger(unit, value, turns?) / unit.certifiedBanger()
isEnemy(view)                                               // narrow event targets
```

## Events

`k.on(event, origin, filter, handler)`, where `filter` is
`{ subject?, abilityKinds?, tags?, attack?, status?, resource?, limitPerTurn?, limitPerAction? }`.

`subject` is relative to the kit's unit: `self` (default), `selfOrMemosprite`,
`memosprite`, `ally`, `otherAlly`, `enemy`, `any`.

| Event | `unit` | Notes |
|---|---|---|
| `battleStart` | first ally | use `subject: "any"` |
| `turnStart` / `turnEnd` | acting unit | extra turns included |
| `actionStart` / `actionEnd` | acting unit | `abilityId`, `abilityKind`, `tags`, `target`, `attack` |
| `hit` | attacker | once per damage instance and target |
| `weaknessBreak` | breaker | `target` is the enemy |
| `enemyAttack` / `hitByEnemy` | enemy / ally hit | `weight` is the aggro share |
| `statusApplied` | applier | `target`, `status` |
| `dotTick` | enemy | `status`; ticks and detonations |
| `teamResourceChanged` | changer | `resource`, `delta` |
| `ahaInstantStart` / `ahaInstantEnd` | Aha | Elation |

"After X attacks" → `actionEnd` with `attack: true`. "When X uses" →
`actionStart`. "Once per turn" → `limitPerTurn: 1`. Handlers run with
`ctx.weight` (the probability mass). Scale nothing by hand: the API applies
`weight` to everything it records.

## Policies

```ts
k.policy({
  turn: (view) => (view.self.has(enhanced) ? "enhancedBasic" : view.skillPoints >= 1 ? "skill" : "basic"),
  ultimate: (view) => !view.self.has(enhanced),
});
```

`view` gives you `self`, `allies`, `enemies`, `skillPoints`, `maxSkillPoints`,
`cycle`, `time`, and `teamResource(name)`.

## Checking your work

```bash
npm run combat:dossier -- C 1102          # text, IDs, facts, current kit, tracker
npx vitest run tests/combat               # registry health + reference tests
npx tsc -p tsconfig.app.json --noEmit
```

To inspect a timeline in a scratch test, call
`formatTimeline(result.log)` from `src/domain/combat/debug/timeline.ts` and
read `result.report.abilities`.
