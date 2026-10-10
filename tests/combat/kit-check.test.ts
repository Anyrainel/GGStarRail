import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { formatTimeline } from "@/domain/combat/debug/timeline";
import kafka from "@/domain/combat/impl/characters/1005-kafka";
import seele from "@/domain/combat/impl/characters/1102-seele";
import robin from "@/domain/combat/impl/characters/1309-robin";
import type { CharacterKitDefinition } from "@/domain/combat/kit/character";
import type {
  LightConeKitDefinition,
  RelicSetKitDefinition,
} from "@/domain/combat/kit/equipment";
import { createKitRegistry } from "@/domain/combat/kit/registry";
import type { CombatReferenceData } from "@/domain/combat/model/data";
import { simulateTeam } from "@/domain/combat/simulate";
import { type MemberInput, SCENARIO_PRESETS } from "@/domain/combat/team/input";
import { loadCombatReferenceData } from "@/lib/combat/referenceData";

/**
 * Isolated check for kits under translation. Unlike the registry test, it
 * imports only the files named in KIT_FILES (comma-separated paths), so
 * concurrent work on other kits cannot break it:
 *
 *   KIT_FILES=src/domain/combat/impl/characters/1205-blade.ts \
 *     npx vitest run tests/combat/kit-check.test.ts
 *
 * It prints a timeline and ability breakdown for review.
 */
const files = (process.env.KIT_FILES ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

type AnyKit =
  | CharacterKitDefinition
  | LightConeKitDefinition
  | RelicSetKitDefinition;

let data: CombatReferenceData;

beforeAll(async () => {
  data = await loadCombatReferenceData();
});

function member(
  characterId: string,
  overrides: Partial<MemberInput> = {}
): MemberInput {
  return {
    characterId,
    level: 80,
    eidolon: 0,
    traces: {},
    lightCone: null,
    relics: { stats: {}, sets: {} },
    ...overrides,
  };
}

describe.skipIf(files.length === 0)("kit check (KIT_FILES)", () => {
  it.each(files)("%s", async (file) => {
    const module = (await import(/* @vite-ignore */ path.resolve(file))) as {
      default: AnyKit;
    };
    const kit = module.default;
    const fileId = /(\d+)-[^/]+\.ts$/.exec(file)?.[1];
    expect(kit.id).toBe(fileId);
    const characters = [seele, robin, kafka].filter(
      (entry) => entry.id !== kit.id
    );
    const registry = createKitRegistry({
      characters: kit.type === "character" ? [...characters, kit] : characters,
      lightCones: kit.type === "lightCone" ? [kit] : [],
      relicSets: kit.type === "relicSet" ? [kit] : [],
    });
    const runs: MemberInput[] = [];
    if (kit.type === "character") {
      runs.push(member(kit.id), member(kit.id, { eidolon: 6 }));
    } else if (kit.type === "lightCone") {
      const lightCone = data.lightCones.get(kit.id);
      const wearer = [...data.characters.values()].find(
        (character) => character.path_id === lightCone?.path_id
      );
      for (const superimposition of [1, 5]) {
        runs.push(
          member(wearer?.id ?? "1102", {
            lightCone: { id: kit.id, level: 80, superimposition },
          })
        );
      }
    } else {
      const set = data.relicSets.get(kit.id);
      runs.push(
        member("1102", {
          relics: {
            stats: {},
            sets: { [kit.id]: set?.kind === "planar_ornament" ? 2 : 4 },
          },
        })
      );
    }
    for (const main of runs) {
      const result = simulateTeam(
        {
          members: [main, member("1309"), member("1005")].filter(
            (entry, index, all) =>
              all.findIndex(
                (other) => other.characterId === entry.characterId
              ) === index
          ),
          scenario: { ...SCENARIO_PRESETS.bossWithAdds, cycles: 3 },
        },
        data,
        registry
      );
      expect(result.log.warnings).toEqual([]);
      console.log(
        `\n=== ${file} (E${main.eidolon} S${main.lightCone?.superimposition ?? "-"})\n${formatTimeline(result.log)}`
      );
      for (const ability of result.report.abilities) {
        console.log(
          `  slot ${ability.slot} ${ability.abilityId} [${ability.kind}] ${ability.damage.toFixed(0)} (${ability.hits} hits)`
        );
      }
      for (const group of result.model.groups) {
        const damage = result.model.evaluateGroup(group, {
          panel: (id) => result.team.units().get(id)!.panel,
        });
        expect(Number.isFinite(damage)).toBe(true);
      }
    }
  });
});
