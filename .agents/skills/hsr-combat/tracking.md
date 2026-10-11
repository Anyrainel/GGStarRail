# Tracker and tools

## Tools

| Command | Purpose |
|---|---|
| `npm run combat:dossier -- C\|L\|R <id>` | Entity dossier: EN/ZH text with resolved `#n`, catalog IDs, per-skill facts (Toughness, Energy, SP), current kit, tracker items |
| `npm run combat:dossier -- list C\|L\|R [--missing]` | Implementation coverage |
| `KIT_FILES=<paths> npx vitest run tests/combat/kit-check.test.ts --reporter=verbose --disableConsoleIntercept` | Isolated check of specific kits, with timeline and ability breakdown |
| `npx vitest run tests/combat` | Registry health (every kit at E0/E6, S1/S5, all set tiers) and reference tests |
| `formatTimeline(log)` | Action-by-action timeline for a scratch test |

The facts in the dossier come from TurnBasedGameData at the revision pinned in
`data-bundle.lock.json`, cached under `.cache/combat-facts/`.

## Tracker files

`docs/combat/tracker/`:

| File | Scope |
|---|---|
| `destruction.yaml`, `hunt.yaml`, `erudition.yaml`, `harmony.yaml`, `nihility.yaml`, `preservation.yaml`, `abundance.yaml`, `remembrance.yaml`, `elation.yaml` | Characters by Path |
| `light-cones.yaml` | all Light Cones |
| `relic-sets.yaml` | Cavern Relics and Planar Ornaments |
| `engine.yaml` | engine gaps, mechanics to verify, data needs |

## Item schema

```yaml
- id: kafka-e1-chance        # unique within the file: {entity-slug}-{2-3 words}
  entity: "1005"             # catalog ID, or "engine"
  rule: U9                   # rule that flagged it (translator-rules.md)
  status: open               # open | actionable | wont-do | completed
  category: bug              # see below
  summary: >
    One or two self-contained sentences.
  detail: ""                 # depends on status (below)
```

| Category | Meaning |
|---|---|
| `bug` | the kit contradicts the game text |
| `approximation` | deliberate simplification that could be more exact |
| `engine-gap` | needs an engine capability that does not exist |
| `needs-data` | missing game data (hit splits, amounts, constants) |
| `missing-ability` | a damaging ability or proc is absent |
| `verify` | a mechanic needs in-game or external confirmation |

## State machine

```text
open ──triage──▶ actionable ──implement──▶ completed ──review──▶ (deleted)
  └────triage──▶ wont-do ─────────────────────review (if moot)─▶ (deleted)
any ──manual──▶ open
```

- `detail` holds research notes when the item is `open`, implementation
  guidance when `actionable`, the rationale when `wont-do`, and the change
  summary when `completed`.
- Review agents delete `completed`/`wont-do` items whose issue no longer exists.
  They reopen an item when its fix is incomplete.
- Append new items at the end of a file. Update items in place and never
  duplicate them.
