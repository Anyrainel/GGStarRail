# Team damage: product design

Team Damage (`/builds/team-damage`) answers four questions for a team the
user plays:

1. How much damage does this team deal, and from where?
2. What should each member wear from the Relics I own?
3. What would ideal Relics look like, and which stats matter most?
4. Which Light Cone, Relic set, Eidolon, or Superimposition is worth getting?

It favours good defaults over knobs. Every input has a value without user
action, and the page shows where each value came from.

## Inputs and defaults

A saved team (`ggstarrail:teams:v1`) stores only what the user changed. All
other values resolve when the team is simulated, so a new account import
updates every team.

| Input | Default, in order | Override |
|---|---|---|
| Character level, Traces | account | level |
| Eidolon | account, else E0 | E0–E6 |
| Light Cone | equipped, then the Character's preferred Light Cone in the user's builds, then the in-game recommendation (S1) | any Light Cone of the Path, S1–S5, or none |
| Relics | equipped when owned, else ideal | equipped / ideal |
| Ideal Relic sets | the user's Character builds, then the in-game recommendations | Cavern 4-piece or 2+2, Planar Ornament |
| Ideal main stats | the same builds | (edited in Character Builds) |
| Skill use | the kit's play pattern | prefer Skill / prefer Basic ATK |
| Conditions | each kit's peak-damage default (see translator rule U8) | per condition |
| Battle | Boss with 2 adds, 3 cycles, enemy level 95 | Single boss, 5 enemies, cycles, enemy level |

Value origins are shown as badges: Account, Your build, Recommended, Default,
Custom. "Not modeled" marks a Character, Light Cone, or set without a kit; the
simulation still uses its catalog stats.

### What is deliberately not an input

Compared with general-purpose optimizers, these are engine decisions rather
than user settings:

- **Rotations.** Turns come from the simulated Action Order: SPD, Energy,
  Skill Points, follow-ups, and each kit's play pattern. Users bias Skill use;
  they do not script turns.
- **Buff uptime.** Buffs exist when the battle applied them. A condition is
  an option only when the battle cannot observe it (enemy HP thresholds,
  kills). Each option is labelled with its source ability and a
  shared condition phrase, so options need no per-Character strings.
- **Enemy stats.** Scenario presets fix count, Toughness, SPD, RES, and Effect
  RES. Teams are compared under the same enemies.
- **Stat weights.** Weights are derived from the damage function at the
  current build, not entered.

## Modes

| Mode | Input | Output |
|---|---|---|
| Simulate (automatic) | the team | damage per cycle, total, share by Character, by ability, by cycle, action timeline, battle stats per member |
| Optimize Relics | one member, minimum SPD | the best loadouts from the account's 5★ Relics at +12 or higher, excluding teammates' Relics |
| Ideal Relics | one member, minimum SPD, substat quality (realistic: 48 average rolls; perfect: 54 high rolls) | main stats, substat rolls, damage, and the relative value of each stat |
| Compare Light Cones | one member | every Light Cone of the Path (5★ at S1, others at S5) with ideal Relics, ranked |
| Compare Relic sets | one member | the best Cavern and Planar combinations, screened per half and then combined |
| Eidolons and Superimpositions | one member | the order of copies that adds the most team damage per copy |

Optimization always scores the whole team's damage, so a support's Relics
are judged by what the team gains. Teammates keep their own gear while one
member is optimized.

## Scenarios

| Preset | Enemies | Toughness | SPD | Use |
|---|---|---|---|---|
| Boss with 2 adds | 3 | 160 | 132 | default; Memory of Chaos style waves |
| Single boss | 1 | 300 | 144 | boss fights, single-target value |
| 5 enemies | 5 | 90 | 120 | AoE value |

All presets use enemy level 95, 20% RES (0% against their Weaknesses), 30%
Effect RES, and 10 Energy per enemy attack. The enemies are weak to the
team's Combat Types.

## Accuracy

- Kits are translated from in-game text by agents following
  `.agents/skills/hsr-combat/translator-rules.md`. Known gaps are tracked in
  `docs/combat/tracker/`.
- Expected values replace randomness (see `architecture.md`). Results are
  averages, comparable across builds.
- Allies' HP is simulated as an expected share of Max HP: costs, healing,
  and a fixed share lost per enemy attack. Shields, enemy HP, and kills are
  not simulated; where they change damage, kits expose a condition option
  and file an approximation item.
