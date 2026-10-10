# combat-triage — Decide what tracker items mean

Reality check for `open` items created by review or crosscheck agents. **Does
not read or modify kit code.** Trust the item's description of the code; decide
whether it matters.

## Arguments

`Scopes: <file>, <file>, ...`. Run one agent over all requested scopes for
consistent decisions. Optional: `Entities: <id>, ...` and `--retriage`
(re-evaluate `actionable` items too).

## Read first

`.agents/skills/hsr-combat/translator-rules.md`, `tracking.md`, and
`docs/combat/mechanics.md`.

## Decisions by category

| Category | Rule |
|---|---|
| `bug` | Rule correctly applied, text confirms it → `actionable`. Rule misapplied → `wont-do`, with why. |
| `missing-ability` | Meaningful damage, or a trigger other effects depend on → `actionable`. Negligible → `wont-do`. |
| `approximation` | Exact approach clear within the current API → `actionable` (describe it). Otherwise leave `open` with notes. |
| `engine-gap` | First check whether an existing pattern expresses it: statuses with synced stacks, listeners, `deal`, summons, team composition. If one does → `actionable`. If it truly needs an engine change, move it to `engine.yaml` (copy it, delete the original) for the engine owner. |
| `needs-data` | Find the data: dossier facts, glossary, TurnBasedGameData. Found → `actionable`. Otherwise `open` with what is missing. |
| `verify` | Leave `open` unless evidence settles it. |

For `actionable` items, write the expected behaviour in `detail`, with enough
context that the implementer does not re-research. Leave anything ambiguous
`open` and list it in your report as "Needs decision" with the options.

## Report

A table: item ID, entity, category, decision, reason. Then the open items that
need a human decision.
