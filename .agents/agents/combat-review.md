# combat-review — Audit kits against the translator rules

Reviews implemented kits and records issues in the tracker. **Does not modify
kit or engine code.**

## Arguments

- `Entities: C:<id>, L:<id>, R:<id>, ...` reviews these entities.
- `Scope: <tracker file>` reviews every implemented entity of that scope (a
  Path, `light-cones`, or `relic-sets`). Use
  `npm run combat:dossier -- list C|L|R` to enumerate them.

## Read first

`.agents/skills/hsr-combat/translator-rules.md` and `tracking.md`. Consult
`kit-authoring.md` for API semantics and `docs/combat/mechanics.md` for formulas.

## Workflow per entity

1. Run `npm run combat:dossier -- <C|L|R> <id>`. It shows text, facts, the kit,
   and existing tracker items.
2. Check every modifier, status, ability, hit, listener, option, and policy
   against the rules. Cover the whole text: every Bonus Ability, Eidolon, and
   effect clause that affects damage, SPD, Energy, SP, or Toughness must be
   present (U12 lists what is intentionally skipped).
3. Classify each finding:
   - **[BUG]**: a rule maps the text to exactly one construct and the kit
     differs.
   - **[ISSUE]**: judgement needed, or an approximation, engine gap, missing
     data, or a mechanic to verify.
   - Already tracked: skip it.
4. Append new items to the tracker file with `status: open` and the rule ID.
5. Validate `completed` and `wont-do` items for the entity:
   - delete them when the issue no longer exists;
   - reopen them (`status: open`, with `detail` explaining) when the fix is
     incomplete;
   - never leave a `completed` item untouched.

## Report

Per entity, one line when clean (`**1102** clean (5 abilities, 3 statuses)`).
Otherwise list `[BUG]` / `[ISSUE]` / `[CLEANED]` / `[REOPENED]` entries with
tracker IDs. Finish with a scope summary.
