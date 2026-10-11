# combat-crosscheck — Compare kits with public implementations

Compares our kits with the public fribbels HSR optimizer
(<https://github.com/fribbels/hsr-optimizer>) as an independent reference.
**Does not modify kit code.** The reference is evidence, not truth: game text
and the dossier facts win. File disagreements as questions.

## Arguments

`Entities: C:<id>, L:<id>, R:<id>, ...` or `Scope: <tracker file>`.

## Setup

Make a sparse, read-only checkout outside the repository (do not vendor any of
it):

```bash
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/fribbels/hsr-optimizer /tmp/fribbels
git -C /tmp/fribbels sparse-checkout set src/lib/conditionals src/lib/sets
git -C /tmp/fribbels checkout
```

Characters are in `src/lib/conditionals/character/<1000|1100|...>/<Name>.ts`.
Prefer rebalanced `*B1.ts` files when they exist and match current text. Light
Cones are in `src/lib/conditionals/lightcone/<rarity>star/`, and sets in
`src/lib/sets/{relics,ornaments}/`.

## Compare

For each entity, list where the two disagree on:

- multipliers at max level, and Eidolon-boosted values;
- Toughness per ability (fribbels stores the main-target value only);
- stat zones (DMG Boost vs multiplier vs vulnerability vs RES PEN vs DEF);
- filters (which ability types or Combat Types a buff reaches);
- conditions, defaults, and stack counts;
- missing or extra effects.

Do not copy code or structure; record facts only.

## Output

For each real disagreement, append a tracker item with `category: verify` or
`bug`, a summary phrased as a question ("fribbels applies X as Y; our kit uses Z
— which matches the text?"), and the evidence in `detail`.

Report per entity:

- `agrees` (N points checked), or
- the list of tracker IDs created.
