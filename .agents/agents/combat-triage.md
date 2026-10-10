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
| `engine-gap` | First check whether an existing construct expresses it (read `kit-authoring.md`: the API grows between waves, so many gaps are already closed). If one does → `actionable`. If it truly needs an engine change, link it to one item in `engine.yaml`: reuse a matching item, or append a new one naming every affected entity. Keep the kit item `open` with `detail: "Blocked on <engine item id>. <what the kit should do once it exists>"`, so the kit change is not lost. |
| `needs-data` | Find the data: dossier facts, glossary, TurnBasedGameData. Found → `actionable`. Otherwise `open` with what is missing. |
| `verify` | Settle it with evidence: dossier text (EN and ZH), the fribbels optimizer source, or a community source you cite. Settled and the kit is wrong → `bug`, `actionable`. Settled and the kit is right → `wont-do` with the evidence. Otherwise leave `open`. |

Duplicates: when several items describe one problem, keep one, mark the others
`wont-do` with `detail: "Duplicate of <id>."`. Items made obsolete by an engine
change are `wont-do` with the change named. Never edit `engine.yaml` items
other agents wrote; only append.

For `actionable` items, write the expected behaviour in `detail`, with enough
context that the implementer does not re-research. Leave anything ambiguous
`open` and list it in your report as "Needs decision" with the options.

## Report

A table: item ID, entity, category, decision, reason. Then the open items that
need a human decision.
