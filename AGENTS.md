# GGStarRail contributor rules

- Keep this repository independent from GenshinTools. Architectural ideas may
  be reimplemented, but do not copy its game data, assets, imports, stores,
  migrations, engines, cloud code, identifiers, or secrets.
- Use HSR terms: Character, Light Cone, Relic, Planar Ornament, Eidolon,
  Superimposition, Trace, Path, Combat Type, Planar Sphere, and Link Rope.
- Keep stable IDs language-neutral. Every user-facing string belongs in the
  typed `en` and `zh-CN` catalogs.
- All persistent keys start with `ggstarrail:`. Do not add cross-product
  migration fallbacks.
- Authentication-cookie material is memory-only for one request. Never persist,
  export, back up, log, place in a URL, or attach it to an error object.
- Provider DTOs stay in `src/providers`; canonical state must not import them.
- Do not add team damage optimization, Genshin formula engines, or energy
  calculators without an explicit scope change.
- Do not add live Worker bindings, account IDs, resource IDs, routes, secrets,
  deployment workflows, or remotes as part of ordinary feature work.
- Run `npm run check` and `git diff --check` before committing.
