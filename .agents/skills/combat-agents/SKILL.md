---
name: combat-agents
description: Launch HSR combat translation workers (implement, review, triage, crosscheck). Use when asked to implement, translate, review, audit, triage, or cross-check Character, Light Cone, or Relic set kits in src/domain/combat/impl, or to process the combat tracker.
---

# Combat agent dispatch

Launch the right worker with the right scope. Each worker reads its own
instructions; you do not need to read the reference material yourself.

| Worker | Instructions | Writes |
|---|---|---|
| implement | `.agents/agents/combat-implement.md` | kit files, tracker items |
| review | `.agents/agents/combat-review.md` | tracker items only |
| triage | `.agents/agents/combat-triage.md` | tracker items only |
| crosscheck | `.agents/agents/combat-crosscheck.md` | tracker items only |

## Launch prompts

```text
Read `.agents/agents/combat-implement.md` and follow its instructions. Entities: C:1205, C:1212, L:23018
Read `.agents/agents/combat-review.md` and follow its instructions. Scope: hunt
Read `.agents/agents/combat-triage.md` and follow its instructions. Scopes: hunt, light-cones
Read `.agents/agents/combat-crosscheck.md` and follow its instructions. Entities: C:1005
```

Tell every worker that it is not alone in the codebase:

- it must not revert others' edits;
- it must adapt to concurrent changes;
- it must keep to its own files.

## Sizing and parallelism

- **implement**:
  - Characters: 3–5 per agent, grouped by Path so a worker learns one Path's
    conventions.
  - Light Cones: 10–15 per agent, grouped by Path.
  - Relic sets: 10–15 per agent.
- **review / crosscheck**: one agent per tracker scope.
- **triage**: always one agent for every scope, for consistent decisions.
- Parallel is fine when agents write different kit files and different tracker
  files.
- Run review → triage → implement sequentially for the same scope.
- Coverage: `npm run combat:dossier -- list C|L|R --missing`.

## Pipelines

1. New game version:
   - `list --missing` → implement the new entities.
   - Review them, then triage, then implement the actionable items.
2. Quality sweep: review all scopes in parallel → one triage → implement.
3. External check: crosscheck a scope → triage → implement.
4. Engine gaps: items in `docs/combat/tracker/engine.yaml` go to the engine
   owner (a person or a lead agent). Kit workers never edit engine code.
