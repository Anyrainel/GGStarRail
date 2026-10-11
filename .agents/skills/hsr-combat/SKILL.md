---
name: hsr-combat
description: >
  Translate or verify Honkai: Star Rail game text as combat kits in src/domain/combat/impl (Characters, Light Cones,
  Relic sets), and check concrete mechanics (damage zones, durations, Energy, Toughness, Elation). Use when
  implementing, reviewing, or debugging a specific kit or formula. Do not use for UI, product planning, or optimizer
  design work unless it needs one of these concrete checks.
---

# HSR combat knowledge

Reference for turning in-game descriptions into unambiguous kit code. To launch
workers (implement, review, triage, crosscheck), use the `combat-agents` skill
instead.

| Topic | File | Covers |
|---|---|---|
| Translator rules | `translator-rules.md` | U-series (all entities), C-series (Characters), E-series (equipment): text → construct |
| Kit authoring | `kit-authoring.md` | File layout, builder, modifiers, statuses, abilities, hits, battle API, events, policies |
| Tracker and tools | `tracking.md` | Dossier and coverage commands, tracker schema and state machine |
| Mechanics | `docs/combat/mechanics.md` | Formulas, constants, timing conventions, and the evidence behind them |
| Architecture | `docs/combat/architecture.md` | Engine layers and their APIs (for engine work, not for kits) |

First step for any entity: `npm run combat:dossier -- C|L|R <id>`.
