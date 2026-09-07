# GGStarRail

**English** | [简体中文](README.zh-CN.md)

<div align="center">

### Manage Relics, plan character builds, and track your Honkai: Star Rail account progress.

[Open GGStarRail](https://hsr.ggartifact.com)

</div>

---

## What You Can Do

- **Organize your Relics**: find pieces to keep, review, or consider salvaging based on your inventory and build targets.
- **Assess build progress**: score individual Relics and equipped builds, then check missing pieces, set bonuses, and main stats.
- **Plan better builds**: choose Cavern Relic and Planar Ornament sets, set stat preferences, and find matching equipment in your inventory.
- **Plan resource spending**: review candidates for leveling, synthesis, and Variable Dice.
- **Set personal priorities**: organize Characters, Light Cones, and Relic sets in your own tier lists.
- **Look up game data fast**: browse Characters, Light Cones, Relic sets, and achievements in English or Simplified Chinese.

## Start Here

- **Import account data** in Account Data using a supported scanner JSON file or a public UID showcase.
- **Configure character builds** in Builds with your preferred sets, main stats, and scoring weights.
- **Review your equipment** in Account Data to see equipped builds and browse your inventory.
- **Find pieces worth keeping or improving** in Relic Triage and Resources.

## Tools

### Account Data

Use your imported account to review equipment and decide what to improve next.

- Browse owned Characters, progression, Eidolons, Traces, and equipped gear.
- Filter Light Cones, Cavern Relics, and Planar Ornaments by their stats and status.
- Review Relic scores and how well equipped pieces match your build targets.
- Find promising Relics to level, build slots to target with synthesis, and pieces to review for Variable Dice.
- Sort Relics into keep, review, and salvage-review groups, with protection for equipped, locked, or uncertain pieces.
- Preview and export lock and discard-mark instructions for the GOODScanner manager.

### Builds

Define the equipment you want for each Character and find pieces that fit.

- Configure a 4-piece Cavern set and 2-piece Planar set, or use a 2+2 Cavern combination.
- Choose main stats for Body, Feet, Planar Sphere, and Link Rope.
- Customize substat weights and grade thresholds for Relic scoring.
- Generate filters for all six slots from your build targets.
- Compare matching equipment from your imported inventory using your scoring preferences.

### Tier List

Maintain personal priority lists for your account planning.

- Arrange Characters by Combat Type.
- Organize Light Cones by Path.
- Rank Cavern Relic and Planar Ornament sets by role and personal preference.

### Archive

Browse game data without opening another reference site.

- Character skills, stats, Eidolons, Traces, and progression materials.
- Light Cone effects, Superimposition ranks, stats, and progression materials.
- Cavern Relic and Planar Ornament pieces and set effects.
- Achievements with search, category filters, and imported or locally tracked completion progress.

## Import And Data Notes

- Supported files include GGStarRail, GOODScanner HSR, Reliquary, HSR-Scanner, Kel, and Fribbels v4 JSON. Review an import before applying it.
- Full inventory workflows require a scanner or capture export that includes your unequipped items.
- Enka / MiHoMo UID import only includes public showcase Characters and their equipment. Partial imports preserve richer inventory data already imported for the same account.
- HoYoLAB / Miyoushe import is also available for roster and equipped-gear data. It requires a user-provided cookie; authenticated imports have not yet been verified end to end. Any account verification must be completed in the official app or site.
- App data is saved in your browser. Cloud backup is not currently available. Import cookies are used only for the request and are not saved.
- Relic scores reflect your chosen stat weights. GGStarRail does not currently calculate team damage or optimize team damage assignments.
- Triage provides suggestions and scanner instructions; the website itself does not change your in-game items.

## Local Development

```bash
npm ci
npm run data:restore
npm run assets:webp
npm run dev
```

`data:restore` downloads and verifies the data and assets pinned to this checkout. A fresh clone does not need a local GIlore repository.

Useful commands:

- `npm run check` runs the full validation suite, including tests and a production build.
- `npm run dev:worker` starts the local account-import Worker.
- `npm run demo:start` starts or reuses a detached demo on port 41737 (Windows/PowerShell).

See [Hosting and data updates](docs/deployment.md) for deployment and data maintenance, [Source provenance](docs/source-provenance.md) for data sources, and [Account imports](docs/account-imports.md) and [Security](docs/security.md) for import details.

## Built With

- React 19, TypeScript, Vite 7
- Tailwind CSS, Radix primitives, Lucide icons
- Zustand
- Cloudflare Workers

---

Fan-made tool. Not affiliated with HoYoverse.
