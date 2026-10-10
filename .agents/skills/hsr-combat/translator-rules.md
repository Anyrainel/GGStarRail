# Translator Rules — HSR game text → combat kits

Each rule maps in-game wording to one construct of the kit API
(`kit-authoring.md`). Review agents cite rule IDs in tracker items.

- **[U]** rules apply to every entity (Character, Light Cone, Relic set).
- **[C]** rules apply to Characters only.
- **[E]** rules apply to Light Cones and Relic sets only.

A violation of a rule whose table maps the text to exactly one construct is a
**[BUG]**. When the correct construct needs judgement, it is an **[ISSUE]** (see
`tracking.md`).

Always start from the dossier: `npm run combat:dossier -- C|L|R <id>`. It
prints EN and ZH text with every `#n` placeholder resolved, the catalog IDs,
the game's per-skill Toughness/Energy/SP facts, the current kit, and open
tracker items.

---

## Universal rules

### U1. Numbers come from parameters

- A value written `#n` in the text must be read with `k.param(skillId, n)`,
  `k.traceParam(a, n)`, `k.rankParam(e, n)`, `k.s(n)` (Light Cones), or
  `k.param(n)` (Relic sets). **[BUG]** if hard-coded.
- Values printed without a placeholder (e.g. "SPD 160/240/320" in Aglaea E6)
  are hard-coded, with a comment quoting the text.
- `k.param` resolves the effective ability level (Trace level, or the normal
  maximum when unknown, plus Eidolon bonuses parsed from E3/E5 text). Never
  check Eidolon 3/5 manually. **[BUG]** if a kit branches on `k.e(3)`/`k.e(5)`
  to change a multiplier.
- Toughness, Energy, and Skill Point values come from the dossier's `facts:`
  line (game data). Use them verbatim. **[BUG]** if a kit disagrees with the
  facts without a comment explaining why.

### U2. Stat keys

| Game text | Stat | Notes |
|---|---|---|
| ATK/HP/DEF +X% | `atkPct` / `hpPct` / `defPct` | |
| ATK/HP/DEF +N (flat) | `atkFlat` / `hpFlat` / `defFlat` | |
| SPD +X% / SPD +N | `spdPct` / `spdFlat` | |
| CRIT Rate / CRIT DMG | `critRate` / `critDmg` | |
| Break Effect | `breakEffect` | |
| Weakness Break Efficiency | `breakEfficiency` | |
| Effect Hit Rate / Effect RES | `effectHitRate` / `effectRes` | |
| Energy Regeneration Rate | `energyRegen` | |
| Outgoing Healing Boost | `outgoingHealing` | |
| Elation +X% | `elation` | Elation DMG only (not DMG Boost) |
| "merrymakes" / Merrymake +X% | `merrymaking` | |
| "DMG dealt +X%", "DMG Boost", "deals X% more DMG" | `dmgBoost` | additive zone |
| "<Type> DMG +X%" (e.g. Quantum DMG) | `dmgBoost` + `filter.combatTypes` | |
| "Basic ATK / Skill / Ultimate / Follow-Up ATK DMG +X%" | `dmgBoost` + `filter.tags` | U4 |
| "DoT dealt +X%" | `dmgBoost` + `tags: ["dot"]` | |
| "Break DMG +X%" | `dmgBoost` + `tags: ["break"]` | covers Super Break |
| "Super Break DMG +X%" (increase) | `dmgBoost` + `tags: ["superBreak"]` | |
| "converts Toughness Reduction into Super Break DMG at X%" | `superBreakDmg` | the Super Break multiplier |
| "ignores X% of DEF" (attacker side) | `defIgnore` | |
| enemy "DEF −X%" (debuff) | `defReduction` | on an enemy status (U3) |
| "RES PEN +X%" (attacker side) | `resPen` (+ `combatTypes` when typed) | |
| enemy "RES −X%" / "All-Type RES −X%" (debuff) | `resReduction` | on an enemy status |
| enemy "takes X% more DMG" / "DMG taken +X%" | `vulnerability` | on an enemy status; tags when typed |
| "DMG dealt becomes X% of the original" / "×X" | `dmgMultiplier` = X − 1 | separate multiplicative zone |
| "increases the DMG multiplier by X%" (adds to the ability %) | `multiplierBoost` | adds to the per-hit multiplier |
| "multiplier increases by X% of its original multiplier" | `dmgMultiplier` = X | |
| "additionally deals True DMG equal to X% of the DMG" | `trueDmg` | |
| "Elation DMG ignores X% DEF" | `defIgnore` + `tags: ["elation"]` | |

**[BUG]** if a DMG increase scoped by the text to an ability type, Combat Type,
or DoT is unfiltered. This is the most common mistake: check every
`dmgBoost` against the text.

### U3. Holder: who carries the modifier

| Text | Construct |
|---|---|
| unconditional, on the owner | `k.stat(origin, modifier)` |
| unconditional, "all allies" / "teammates" | `k.teamStat(origin, modifier, "allies" \| "otherAllies")` |
| conditional or timed, on a unit | a status (`k.status`) applied with `ctx.applyStatus(unit, status)` |
| enemy debuff (DEF/RES reduction, vulnerability) | a status with `debuff: true`, applied to the enemy |

- Incoming stats (`vulnerability`, `defReduction`, `resReduction`,
  `dmgMitigation`) only work on statuses held by enemies. Outgoing stats only
  work on allies. The engine ignores the wrong side, so **[BUG]** if an enemy
  debuff is modelled as an ally buff or vice versa.
- "all allies" / "ally targets" includes memosprites. "ally characters"
  excludes them: skip `unit.kind === "memosprite"` when iterating
  `ctx.allies`.
- Effects "on this unit and its memosprite" apply the status to both.

### U4. Damage tags

| Text | Tags |
|---|---|
| Basic ATK, Enhanced Basic ATK | `basic` |
| Skill, Enhanced Skill | `skill` |
| Ultimate | `ultimate` |
| Follow-Up ATK | `followUp` |
| Additional DMG | `additional` only (not the ability's type) |
| DoT | `dot` |
| Memosprite DMG | `memosprite` (added automatically to memosprite abilities) |
| Elation DMG / Elation Skill | `elation` (Elation Skill abilities default to it) |
| Joint ATK | `joint` plus the ability type |
| "This DMG is considered X DMG" | add `X` via `tags` |
| "This DMG is not considered X DMG" | `onlyTags` without `X` |

### U5. Durations

- "for N turn(s)" → `duration: { turns: N }`. The default counts down at the
  end of the holder's turn, and a status applied during the holder's own turn
  does not count that turn. The engine handles this.
- "This duration decreases by 1 at the start of X's every turn" →
  `countdown: "turnStart"`, plus `clock: "applier"` when X is the caster rather
  than the holder.
- "until the end of X" / "removed when ..." → no duration; remove it with
  `ctx.removeStatus` in the matching listener.
- "lasts until the next time X" → remove on the triggering event (the
  Ashblazing pattern).

### U6. Stacks

- "stacks up to N times" → `maxStacks: N`. The modifier `value` is per stack.
- "gains N stacks" → `applyStatus(..., { stacks: N })`. "Resets stacks" or
  "sets to N" → `setStacks`.
- Counts derived from battle state ("for each Punchline owned") → a status
  whose stacks are synced with `ctx.setStatusStacks` by the listener that
  changes the state (`teamResourceChanged`, `skillPointsChanged`, ...). Do
  not compute such counts inside modifiers, and do not re-apply a debuff to
  change its stacks (that resets its landing chance).
- "X at 1 stack, +Y per additional stack" = (X − Y) + Y × stacks: the stacking
  status carries `value: Y`, and a companion status (not a debuff, so it is
  not counted twice) carries `X − Y` while at least one stack is present.

### U7. Stat-dependent values

| Text | `scaling` |
|---|---|
| "increases Y by X% of Z" | `{ source, stat: Z, ratio: X }` |
| "...of Z exceeding T" | add `threshold: T` |
| "for every S of Z..." | add `step: S` (floors) |
| "...up to M" | add `cap: M` (total, not per step) |
| "when Z reaches T or higher, Y +X" | `{ stat: Z, atLeast: T, ratio: X }` |

- `source: "holder"` reads the unit carrying the modifier.
  `source: "applier"` reads the unit that applied the status (Robin's ATK for
  Concerto).
- Scaling reads stats before any scaling modifier, so conversions never feed
  conversions. An applier is read at its steady panel (base, equipment,
  permanent effects).

### U8. Conditions: engine, team, or option

Decide in this order:

1. **The engine models it**: use the event or state. This covers turns,
   extra turns, actions, ability use, hits and the enemies each action hit,
   Weakness Break and Broken state, statuses and their families on the target
   (U14), debuff counts, Skill Points gained and spent, Energy, being hit by
   enemies (aggro-weighted), enemy SPD changes, memosprite presence,
   Punchline, and Certified Banger. Do not add an option for these.
2. **Team composition** ("if there are N Nihility allies"): `k.countPath`,
   `k.countCombatType`, `k.team`. Path IDs are catalog IDs: Warrior =
   Destruction, Rogue = The Hunt, Mage = Erudition, Shaman = Harmony, Warlock =
   Nihility, Knight = Preservation, Priest = Abundance, Memory = Remembrance,
   Elation = Elation.
3. **Unmodelled environment**: an option with the shared vocabulary
   (`k.toggle`/`k.count`). Defaults:

   | Condition | Default |
   |---|---|
   | enemy HP ≤ X% with X ≥ 50 | on |
   | enemy HP ≤ X% with X < 50 | off |
   | enemy HP ≥ X% with X ≤ 50 | on |
   | enemy HP ≥ X% with X > 50 | off |
   | own HP ≥ X% | on |
   | own HP ≤ X% | off, unless the kit consumes its own HP |
   | "upon defeating an enemy" | off (boss scenarios) |
   | per-cycle frequency of an unmodelled trigger | `count` with the typical value |

   **[BUG]** for an option that duplicates something the engine models, or a
   condition hard-coded on when the table says otherwise.

### U9. Probability

- "X% base chance to inflict" → `applyStatus(target, debuff, { baseChance: X })`.
  The landing chance is evaluated from the applier's Effect Hit Rate, so do not
  multiply anything by chance yourself.
- "fixed chance" and guaranteed effects → no `baseChance`.
- Random targets → `shape: "bounce"` with `bounces` (expected distribution).
- Random gifts or outcomes → expected values (e.g. half of each of two equal
  outcomes), with a comment. Outcomes that change the action taken → queue
  each branch with its probability (`queueAction(..., { weight })`); limits
  and counters add the branches up correctly.
- A chance-based buff on an ally → `stacks: chance` (statuses are not
  weighted for you). Control debuffs ("Frozen", "cannot act") → a status with
  `skipsTurn: true` applied with `baseChance`.

### U10. Energy and Skill Points

- "regenerates N Energy" → `ctx.gainEnergy(unit, N)` (scaled by ERR). Use
  `{ fixed: true }` only when the text marks it as unaffected by ERR, or the
  glossary says so.
- An ability's own Energy and SP come from facts: set `energy`/`skillPoints`
  only when they differ from the kind defaults (Basic 20/+1, Skill 30/−1,
  Ultimate 5, Elation Skill 5).
- "recovers N Skill Point(s)" → `ctx.gainSkillPoints(N)`.
- "cannot recover Skill Points" → `skillPoints: 0` on that ability.
- "Skill Point limit +N" → `ctx.setMaxSkillPoints(ctx.maxSkillPoints + N)`.
- "when an ally consumes / recovers Skill Points" → `skillPointsChanged`
  (`event.delta` < 0 / > 0).
- "excess Energy" / overflow → the return value of `ctx.gainEnergy`.
- An Ultimate paid with something other than Energy ("consumes 6 Flying
  Aureus") → `resource: { counter, amount }` on the Ultimate, with the
  resource kept in a counter.

### U11. Action order

| Text | Construct |
|---|---|
| "advances action by X%" | `advanceAction(unit, X)` |
| "immediately takes action" | `advanceAction(unit, 1)` |
| "delays action by X%" | `delayAction(unit, X)` |
| "gains 1 extra turn" | `grantExtraTurn(unit)` |
| leaves / rejoins the Action Order | `setInActionOrder` (+ `castOutsideActionOrder` on an Ultimate still usable then) |
| a countdown with fixed SPD | `k.summon({ speed, abilities, policy })` |
| "does not end the turn" / "can use X again" | `endsTurn: false` on the ability |
| enemy "SPD −X%" (Slow) | `spdPct` on an enemy debuff with `family: "slow"` |

### U12. Effects that are not modelled

Skip these silently: healing, shields, damage reduction taken by allies, HP
costs (unless they trigger damage effects), Crowd Control resistance, aggro
changes, and Technique effects. **[TRACK]** (`engine-gap`) if any of them
converts into a modelled stat or trigger. HP is not simulated: when damage
depends on HP thresholds or HP lost, use a U8 option or a counter fed by
`hitByEnemy` weights, and file an `approximation`.

### U13. Non-stacking effects

"Effects of the same type cannot stack" → `unique: true` on the status, or rely
on team-aura dedupe (identical equipment auras from several wearers keep the
strongest). **[BUG]** if two copies would stack.

### U14. Target state

| Text | Construct |
|---|---|
| "deals X% more DMG to enemies with <status>" | `filter: { targetStatuses: [status.id] }` |
| "... to Burned / Shocked / Slowed enemies" | `filter: { targetFamilies: ["burn"] }` |
| "... to Weakness Broken enemies" | `filter: { targetBroken: true }` |
| "for each debuff on the target" (threshold "at N or more debuffs") | `filter: { minTargetDebuffs: N }` |
| "... to the primary target" (Blast/AoE) | `filter: { targetRoles: ["main"] }` |
| "if the target is X" inside a handler | `target.has(s)`, `target.hasFamily(f)`, `(target as EnemyView).broken` |

**[BUG]** if a kit emulates these by applying and removing self statuses
around hits: the filters see the target as it was when each hit landed.

### U15. Status families

Statuses that game text names generically ("Burn", "Shock", "Bleed", "Wind
Shear", "Frozen", "Entanglement", "Imprisonment", "Slow") must declare
`family`. Effects that check "Burned" enemies use the family, so they also see
Break Burn and other Characters' Burns. **[BUG]** if such a status has no
family.

---

## Character rules

### C1. Ability coverage

- Every damaging ability in the kit text is modeled, including enhanced
  variants, memosprite abilities, follow-ups, and Elation Skills. A
  non-damaging ability is still defined when it changes state (buffs, SP,
  Energy, summons).
- Ability IDs: `basic`, `skill`, `ultimate`, `followUp`, `elationSkill` are
  reserved names that the engine and policies use. Enhanced variants use
  descriptive IDs (`enhancedBasic`, `enhancedSkill`) selected by the turn
  policy. Ultimate variants are separate `kind: "ultimate"` abilities chosen
  by returning their ID from the Ultimate policy.
- Damage dealt with `ctx.deal` inside an ability is credited to that ability.
  Procs from listeners pass `abilityId` so the breakdown names them.
- **[BUG]** if a damaging row in the text has no hit anywhere in the kit.

### C2. Hits

- One `HitDef` per damage instance group. Multipliers are per target role:
  `main`, `adjacent` (Blast), `each` (AoE, Bounce). An AoE dealing X to the
  target and Y to the others sets both `main` and `each`. "Distributed evenly
  across all enemies" → `shape: "split"`.
- Hit counts or multipliers that depend on battle state (stacks, enemy count)
  → `hits: (ctx) => [...]`. Do not rewrite a static `hits` array in `before`.
- "X% of ATK + Y% of Max HP" → two hits, the second `silent: true`.
- "can reduce Toughness regardless of Weakness Type" →
  `toughnessWithoutWeakness: 1` (a fraction when the text gives one).
- `shape` follows facts (`SingleAttack` → `single`, `Blast` → `blast`, `AoEAttack`
  → `aoe`, `Bounce` → `bounce`) unless the text says otherwise.
- Never sum the multipliers of different instances into one hit when per-hit
  effects exist: Ashblazing stacks, "every time it deals DMG", and per-hit
  triggers count instances. Bounce instances use `bounces`.
- Scaling stat: `stat: "hp" | "def" | "spd"` when the text scales off it.
  `statOwner: "owner"` for memosprite hits that scale off the owner.
- Elation DMG: `kind: "elation"`, with a multiplier from the text. Pass
  `punchline` when the text fixes P (Aha extra turns) or uses Certified Banger
  (`ctx.self.certifiedBanger()`).

### C3. Turn policy

The default turn policy is "Skill when a Skill Point is available, else Basic
ATK". Override it to match common play from the kit. Examples:

- supports that do not need their Skill every turn;
- enhanced states;
- characters that spend more than one SP;
- Skills that are only useful when a buff is missing.

Document the intent in one comment line. The default Ultimate policy is
"when Energy is full". Override it only when the kit needs timing (holding for
a state); `view.upcoming` tells which unit acts next. Turn policies must only
return defined ability IDs. Abilities unusable in a state declare `usable`;
the engine falls back to Basic ATK. Ally-targeted abilities may return
`{ ability, target }` to pick the ally.

### C4. Eidolons and Bonus Abilities

- Gate Eidolon effects with `k.e(n)` and Bonus Abilities with `k.a(n)` (n = 1, 2,
  3 for A2, A4, A6).
- An Eidolon that changes a value replaces it inside the same construct. Do
  not add a second status.
- E3/E5 level bonuses are automatic (U1).

### C5. Memosprites and summons

- Memosprites: `k.memosprite({ servantId, speed, abilities, policy })`. Summon
  them with `ctx.summon(owner, servantId)`. They share the owner's panel. HP and
  SPD come from talent text. Their Energy goes to the owner.
- Joint ATK parts dealt by the memosprite: `ctx.deal(hit, { attacker: memosprite })`.
- Countdowns and summons without stats (Lightning-Lord, Numby, Concerto):
  `k.summon`. They act with the owner's stats.

### C6. Battle start

Technique effects are not modeled. "At the start of battle" effects use the
`battleStart` event. The starting Energy is 50% unless the kit says otherwise
(`k.startingEnergy`).

---

## Equipment rules

### E1. Do not duplicate data

Catalog `properties` (the unconditional stat bonuses of a Superimposition or set
tier) are applied by the engine. **[BUG]** if a kit adds them again. The dossier
labels them "applied from data".

### E2. Wearer and team

- "the wearer" is the kit's unit (`ctx.self`, `k.stat`).
- Light Cone effects only exist when the Path matches; the engine enforces this.
- Team effects from equipment ("all allies") use `teamStat` or statuses on
  allies, subject to U13.

### E3. Conditional set bonuses

Threshold effects ("when CRIT Rate ≥ 70%") use `scaling.atLeast`, which the
engine evaluates against final stats per candidate. **[BUG]** if implemented
as an option.
