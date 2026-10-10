# Combat engine architecture

The combat engine simulates a team's damage over a number of cycles and lets
the optimizer re-score equipment without re-simulating. It lives in
`src/domain/combat/` and is framework-free; `src/lib/combat/` connects it to
catalogs, the account, and the UI.

## Layers

Each layer depends only on the layers above it in this table. The first column
is the directory under `src/domain/combat/`.

| Layer | Owns | Public surface used by the next layer |
|---|---|---|
| `model/` | Combat vocabulary: stats and the `StatVector`, damage tags and kinds, hit filters, formulas (DEF, RES, crit, Toughness, break level base, effect hit), the structural reference data a kit reads | `COMBAT_STATS`, `readStat`/`finalStat`, `HitFilter`, `modifierApplies`, formula functions |
| `kit/` | The language kits are written in: builders (`defineCharacter`, `defineLightCone`, `defineRelicSet`), statuses, modifiers, hits, abilities, policies, options, and the `BattleApi` a kit may call | `KitRegistry`, compiled kits (`CompiledCharacterKit`), API types |
| `battle/` | The deterministic timeline: units and statuses, action gauge, turns and Ultimates, Energy, Skill Points, Toughness and breaks, DoTs, memosprites and summons, Elation, event dispatch | `Battle.run()` → `CombatLog` (hit ledger + actions) |
| `evaluate/` | Damage from a ledger: hit grouping, zone math, landing chances, reports | `DamageModel.total(panels)`, `evaluateGroup`, `buildDamageReport` |
| `team/` | Team input and assembly: scenarios, panels from base stats + Light Cone + Relics + Traces, kit compilation, team auras | `TeamInput`, `assembleTeam()` |
| `simulate.ts` | One call for the UI and tests | `simulateTeam(input) → { log, model, report }` |
| `optimize/` | Equipment search on top of a cached ledger: objective, ideal Relics, inventory search, stat weights, comparisons, investment paths | `TeamObjective`, `generateIdealRelics`, `searchRelics`, `deriveStatWeights`, `compareLightCones`, `compareSetPlans`, `investmentPath` |
| `impl/` | One kit per catalog entity, written by translator agents | default-exported definitions |

`src/lib/combat/` turns persisted teams into `TeamInput`. It resolves each
value from the user's override, then the account, then the user's builds,
then the in-game recommendations. It runs jobs (`simulate`, `optimize`,
`ideal`, `compare`, `investment`) in a module worker, and maps engine
vocabulary to localized labels. Pages only see job requests and responses.

## Why a ledger

Damage depends on two kinds of input:

- **Timeline inputs** decide what happens and when: SPD, Energy Regeneration
  Rate, active set bonuses, and kit choices.
- **Panel inputs** only scale numbers: ATK, CRIT, DMG Boost, and everything
  else that does not move turns.

The battle records every damage instance as a `HitRecord`. It holds who
dealt it, its multiplier and weight, the modifiers active on the attacker
and the target, and the target's state. It holds no equipment-dependent
numbers. `DamageModel` groups records that differ only in multiplier and
weight; damage is linear in both, so one evaluation per group covers them.

Changing a member's Relics then means evaluating the groups with a swapped
panel (`UnitPanels`), which takes about 40 µs for a three-cycle team. A
new timeline is simulated only when a timeline input changes.

Rules that keep this valid:

- Debuff landing chances are resolved at evaluation from the applier's Effect
  Hit Rate, never during the battle. The battle only records the Effect Hit
  Rate the applier had from statuses and team auras when it applied the
  debuff; the panel part comes from the panels being scored. Enemy SPD
  debuffs use their base chance for turn order.
- Kits read stats only through `panelStat`, and the engine through
  `momentaryStat`. Both record the stat in `unit.statReads`. `TeamObjective`
  adds every recorded stat to its timeline cache key, so a policy comparing
  Break Effect, or a Quantum break's delay scaling with Break Effect, causes
  re-simulation when that stat changes.
- Scaling modifiers ("ATK +X% of Effect Hit Rate") are evaluated per group
  from the panels being scored, in two phases so conversions never feed
  conversions.
- Target-state filters ("vs Burned enemies") read a snapshot taken when the
  hit landed, so evaluation never depends on the final battle state. When
  the matching statuses were applied with a base chance, the snapshot keeps
  them apart and evaluation scales the modifier by the chance they landed
  (independent per status; a Poisson-binomial for "at least N debuffs").
  Hits a kit deals "against Shocked enemies" name the debuff (`gatedBy`)
  and inherit its landing chance the same way.

`tests/combat/objective-consistency.test.ts` checks the main invariant: for
any loadout, the objective's score equals a full simulation.

## Expected values

The battle is deterministic. Random events carry a weight equal to their
probability:

- an enemy attack is split across allies by aggro;
- a 60% proc runs with weight 0.6;
- random targets become Bounce placements spread evenly over enemies;
- a branch of a random outcome is a queued action with its probability.

Everything a trigger records scales with its weight: hits, Energy, Skill
Points, counters, action advance, and Toughness. Limits ("once per turn")
count weight. Extra turns accumulate until a whole turn is due. Statuses are
the exception: kits pass weighted stacks explicitly, because many statuses
are thresholds rather than sums.

## Points and resources

Energy, Skill Points, HP, and per-unit counters live in the battle because
they shape the timeline:

- Energy: ERR-scaled gains, overflow reported to the kit, enemy attacks
  distributed by aggro.
- Skill Points: a cap kits can raise, a `skillPointsChanged` event, and a
  fallback to Basic ATK when a turn cannot afford its ability.
- Kit counters: charges, stacks, and custom Ultimate resources such as Flying
  Aureus.
- Team resources: Punchline, which the Aha unit reads for its SPD and its
  Instants.
- HP: an expected share of Max HP per ally, changed by kit costs and
  healing and by enemy attacks, reported as `hpChanged`. Heal amounts read
  the healer's and target's panels, so those reads join the timeline key.

The optimizer never estimates Energy outside the battle; ERR is a timeline
input.

## Kit API boundaries

A kit sees `UnitView`/`EnemyView` (read-only), `BattleApi` (operations), and
`PolicyView` (decisions). It cannot reach units, the queue, or the ledger. New
needs are recorded as `engine-gap` items in `docs/combat/tracker/engine.yaml`
and resolved here, so that the rules in
`.agents/skills/hsr-combat/translator-rules.md` stay the only way to express
each kind of game text.

## Performance

Measured on the development container (Seele and Robin, 3 cycles):

| Operation | Cost |
|---|---|
| Simulate a team | 5–20 ms |
| Evaluate a cached ledger | ~40 µs |
| Ideal Relics (main-stat pruning + greedy substats) | ~0.6 s, ~13k evaluations |
| Inventory search (500 pieces) | ~0.1 s plus one simulation per distinct SPD/ERR |
| Simulate job with ideal Relics for two members | ~1.2 s |
