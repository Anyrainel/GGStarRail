# HSR combat mechanics reference

The engine's formulas and conventions, with the evidence behind each.

| Label | Source |
|---|---|
| [GT] | Game text: the reference bundle, or the TurnBasedGameData glossary (`ExtraEffectConfig`) |
| [GD] | Game data fields (`AvatarSkillConfig`: `ShowStanceList`, `SPBase`, `BPNeed`, `BPAdd`, `SPNeed`) |
| [COM] | Community convention |
| [FR] | The fribbels optimizer's model |
| [INF] | Our inference |

Items marked *verify* are tracked in `docs/combat/tracker/engine.yaml`.

## Damage

```text
DMG = Base × DMG Boost × CRIT × DEF × RES × Vulnerability × Mitigation × Toughness × Multiplier × True × Special
```

| Zone | Engine | Notes |
|---|---|---|
| Base | Σ(multiplier + multiplierBoost + elationScaling × Elation) × stat | stat = final HP/ATK/DEF/SPD of the scaling unit |
| DMG Boost | 1 + Σ`dmgBoost` | Excludes Break family unless the filter names `break`/`superBreak`. None for Elation DMG [GT glossary] |
| CRIT | 1 + min(CR,1) × CD | Expected value by default. Not for DoT/Break/Super Break [GT] |
| DEF | (L_a+20) / ((L_e+20)·max(0, 1−reduction−ignore) + L_a+20) | Enemy DEF = 200 + 10·L_e [COM] |
| RES | 1 − clamp(RES − reduction − PEN, −1, 0.9) | Enemy RES 20% (0% to its own weak types) [COM]; implanted Weaknesses do not change RES [TBGD: StanceWeakList and DamageTypeResistance are separate] |
| Vulnerability | 1 + Σ`vulnerability` | No cap known (fribbels caps at 250%) |
| Mitigation | Π(1 − `dmgMitigation`) | Enemy-side |
| Toughness | 0.9 unbroken, 1.0 broken | Applies to every kind [COM]. *verify* for Break and Elation DMG |
| Multiplier | Π(1 + `dmgMultiplier`) | "X% of the original DMG" zones |
| True | 1 + Σ`trueDmg` | "Additionally deals True DMG equal to X%" |

### Break family

`LevelBase(L)` is the attacker-level table (1–80) in `model/formulas.ts`.
`LevelBase(80)` = 3767.5533 [COM, four independent datamines].

| Kind | Formula |
|---|---|
| Weakness Break | LevelBase × Coef(type) × (0.5 + MaxToughness/40) × (1 + BE) × DEF × RES × Vuln × Toughness |
| Super Break | LevelBase/10 × ToughnessReduced × (1 + BE) × `superBreakDmg` × DEF × RES × Vuln |

- Weakness Break coefficients: Physical/Fire 2, Wind 1.5, Ice/Lightning 1,
  Quantum/Imaginary 0.5 [FR][COM].
- Toughness is in display units (Basic ATK 10). Game data stores 3× the
  display value [GD].
- Toughness reduction is multiplied by (1 + Weakness Break Efficiency). Only
  hits matching a Weakness reduce Toughness.
- On break, the enemy's action is delayed by 25% [COM]. Entanglement adds
  20%×(1+BE) and Imprisonment 30%×(1+BE) [COM]. The enemy recovers at its next
  turn start, after DoTs tick.

Break DoTs, each × (1 + BE):

| Effect | Per tick | Duration |
|---|---|---|
| Bleed | 2 × LevelBase × ToughnessFactor (the enemy Max HP cap is not modeled) | 2 turns |
| Burn | 1 × LevelBase | 2 turns |
| Shock | 2 × LevelBase | 2 turns |
| Wind Shear | 1 × LevelBase × stacks | 2 turns |
| Entanglement | 0.6 × stacks × LevelBase × ToughnessFactor | 1 turn |
| Frozen | 1 × LevelBase; skips a turn | 1 turn |
| Imprisonment | none | 1 turn |

### DoT

Base × DMG Boost × DEF × RES × Vuln × Toughness × landing chance. No CRIT. A
DoT ticks at the start of the afflicted enemy's turn, before Weakness Break
recovery. Detonation ("deals X% of its original DMG") records the DoT with
weight X.

### Elation [GT glossary, FR]

```text
Elation DMG = 2 × LevelBase(L) × multiplier × (1 + Elation) × (1 + Merrymake)
              × (1 + 5P/(P + 240)) × CRIT × DEF × RES × Vuln × Toughness
```

- No DMG Boost.
- P is the Punchline taken into account: the team pool for Elation Skills in
  an Aha Instant, the state's value for Certified Banger procs, or a fixed
  value for Aha extra turns.
- Punchline is team-shared, and all of it is consumed after Aha acts.
- Aha is an action-order unit with SPD = 80 + S1/5 + S2/10 + S3/20 + S4/40 over
  the Elation allies' SPD [FR].
- On its turn, every unit with an Elation Skill uses it once. Participants
  then gain Certified Banger (value = P, 2 turns; values add up, timers are
  independent).
- Elation Skills cost no SP and regenerate 5 Energy [GD].
- Battle-start and post-Aha Punchline amounts are *needs-data*.

### Debuff landing

Chance = base × (1 + EHR) × (1 − Effect RES), capped at 1 [GT glossary][COM].
It is evaluated from the applier's panel Effect Hit Rate when damage is
evaluated, so the timeline never depends on EHR. Debuff modifiers and DoT
damage are scaled by the chance.

## Timeline

- Action gauge distance 10,000; time to act = remaining / SPD. SPD changes
  keep the remaining distance [COM].
- The gauge resets at the start of a unit's own turn, so advances during the
  turn apply to the next one.
- Cycles: the first is 150 AV, then 100 AV each [COM].
- Action advance/delay changes the distance by the fraction × 10,000.
- Extra turns run immediately after the current turn, or before the next turn
  when an Ultimate grants them. Ultimates cannot be used during them [GT], and
  they do not reset the gauge. A probabilistic extra turn accumulates: two
  50% grants make one extra turn.
- Ultimates are checked before every turn and after every action. They are
  cast in slot order when Energy (or the kit's Ultimate resource) is full and
  the kit's policy agrees.
- Characters outside the Action Order cannot cast, unless the Ultimate is
  marked usable while Departed.
- Follow-up actions queue after the current action; actions queued at turn
  end resolve before the next unit acts.
- Abilities that "do not end the turn" chain within one turn; Ultimates and
  queued follow-ups may resolve between them.
- Turn order uses SPD from the panel, statuses, and permanent team auras.
  Summons, countdowns, and enemies have a fixed SPD that only statuses on
  them change (Slow, Imprisonment's −10%). Debuffs with a base chance change
  SPD by their base chance (Effect Hit Rate is not read for turn order).
- Control statuses (Break Frozen, kit Freezes) skip the holder's turn; with
  a base chance the enemy acts with the remaining probability mass.

### Expected-value triggers

Random triggers (aggro shares, chances, queued branches) run with a weight
equal to their probability. "Once per turn" style limits count weight, so
several partial triggers add up to at most the limit.

### Durations

- "for N turn(s)" counts down at the end of the holder's turn. A status applied
  during the holder's own turn skips that turn's countdown [COM].
- Explicit "decreases at the start of X's turn" text uses `turnStart` and the
  applier's clock [GT].
- Extra turns count as turns [INF].

### Energy and Skill Points [GD]

- Abilities: Basic 20 Energy and +1 SP; Skill 30 Energy and −1 SP; Ultimate 5
  Energy after use, costing max Energy. Elation Skill gives 5 Energy. Follow-ups
  give 2–10 depending on the kit.
- Memosprite abilities give 10–20 Energy to the owner.
- Battle start: 50% Energy, 3 SP, max 5 SP [COM].
- ERR multiplies Energy except "fixed" sources.
- Enemy attacks give Energy to the ally hit. The engine distributes one
  single-target attack per enemy turn by aggro weight. Base aggro: Preservation
  150, Destruction 125, The Hunt and Erudition 75, others 100 [GD].
- Kills are not simulated.
- The Skill Point cap can change (`setMaxSkillPoints`); every change is
  reported as `skillPointsChanged` after clamping.

### HP [COM, engine model]

- Each ally's HP is a share of its Max HP, starting full. It is an expected
  value: weighted costs and heals change it proportionally.
- Costs stop at 1 HP and heals at Max HP; units are never defeated (HP stays
  at 1% or more).
- Each enemy attack removes 10% of the target's Max HP, split by aggro like
  its Energy. Shields and damage reduction are not modelled, so this is the
  HP lost after them.
- Healing restores the healer's amount divided by the target's Max HP.
- Every change is reported as `hpChanged` with its cause (`consume`, `heal`,
  `enemy`).

## Memosprites [GT talent text, FR, INF]

- HP and SPD come from talent text. All other stats are inherited from the
  owner's panel. SPD% buffs on a memosprite scale its base SPD (a share of
  the owner's SPD, or a fixed value).
- Owner combat statuses do not apply unless the text spreads them. Hits that
  scale with the owner's stat ("DMG equal to X% of <owner>'s Max HP") read
  the owner's stat with the owner's statuses.
- Permanent team auras reach memosprites once, like any ally target.
- "Ally targets" includes memosprites; "ally characters" does not.
- Their Energy goes to the owner.
- Memosprites with SPD 0 have no turns.
