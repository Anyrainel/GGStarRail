# combat-implement — Translate entities into combat kits

Implements new kits, or fixes `actionable` tracker items, for Characters,
Light Cones, and Relic sets.

## Arguments

- `Entities: C:<id>, L:<id>, R:<id>, ...` implements or rewrites these kits.
- `Scope: <tracker file>` processes every `actionable` item in that file.
- `Task: <free text>` is a single ad-hoc change.

You are not alone in the codebase:

- Other agents edit other kit files in parallel.
- Never revert or reformat files you did not create for this task.
- Never edit engine files (`src/domain/combat/{battle,evaluate,kit,model,team}/`).
  Record an `engine-gap` tracker item instead.

## Read first

1. `.agents/skills/hsr-combat/translator-rules.md`
2. `.agents/skills/hsr-combat/kit-authoring.md`
3. `.agents/skills/hsr-combat/tracking.md`
4. Two reference kits closest to your entity (listed in `kit-authoring.md`).

## Workflow per entity

1. Run `npm run combat:dossier -- <C|L|R> <id>` and read all of it. That
   includes the ZH text: when EN and ZH disagree on a number or zone, follow ZH
   and note the conflict in a comment.
2. Write `src/domain/combat/impl/<dir>/<id>-<slug>.ts` at the path the
   dossier prints. Start with a one-line JSDoc naming the entity and Path, as
   the references do.
3. Apply every rule in `translator-rules.md`:
   - numbers through the parameter accessors;
   - Toughness/Energy/SP from facts;
   - correct stat zones and filters;
   - engine events instead of options where the engine models the condition;
   - a turn policy that reflects how the Character is played.
4. Add a comment only where the translation is not obvious from the text
   (approximations, EN/ZH conflicts, assumptions). Do not restate the code.
5. Check your kits in isolation:
   - `KIT_FILES=<path>[,<path>...] npx vitest run tests/combat/kit-check.test.ts --reporter=verbose --disableConsoleIntercept`.
     It runs each kit at E0/E6 (or S1/S5, or the set tiers) in a team with
     Robin and Kafka, then prints the timeline and an ability breakdown.
     Read them: abilities should fire at sensible times, and no damaging
     ability should be missing from the breakdown.
   - `npx tsc -p tsconfig.app.json --noEmit` and fix errors in your own files.
     Other agents' files may be mid-edit; ignore their errors.
   - Finally run `npx vitest run tests/combat`. If it fails only because of
     another agent's file, say so in your report.
6. For anything you could not translate exactly, append an item to the right
   tracker file (`tracking.md`): `approximation`, `engine-gap`, `needs-data`,
   or `verify`, with the rule ID. Do not file items for things the rules already
   resolve.
7. In tracker mode, set the item to `completed` and describe the change in
   `detail`.

## Quality bar

- Model every damaging ability, including Eidolon riders (C1).
- Every number with a `#n` placeholder comes from an accessor (U1).
- No option for anything the engine simulates (U8).
- The kit must make sense in a 4-Character team: team buffs reach allies, and
  triggers from allies are filtered by `subject`.

## Report

End with a short table: entity, file, abilities modeled, tracker items created
(IDs), and anything you are unsure about.
