import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { formatTimeline } from "@/domain/combat/debug/timeline";
import kafka from "@/domain/combat/impl/characters/1005-kafka";
import seele from "@/domain/combat/impl/characters/1102-seele";
import robin from "@/domain/combat/impl/characters/1309-robin";
import {
  type CharacterKitDefinition,
  defineCharacter,
} from "@/domain/combat/kit/character";
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
 *
 * Light Cones are worn by a reference kit of their Path, or by a generic
 * attacker when the Path has none, so on-action effects fire. Relic sets are
 * worn by a generic attacker (Basic ATK, Skill, Follow-up, Ultimate) with
 * Seele's stats. Set WEARER=<character file> to choose the wearer's kit.
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

/** Stable kits used as Light Cone wearers, by catalog Path ID. */
const PATH_WEARERS: Readonly<Record<string, string>> = {
  Warrior: "src/domain/combat/impl/characters/1212-jingliu.ts",
  Rogue: "src/domain/combat/impl/characters/1102-seele.ts",
  Mage: "src/domain/combat/impl/characters/1013-herta.ts",
  Shaman: "src/domain/combat/impl/characters/1309-robin.ts",
  Warlock: "src/domain/combat/impl/characters/1005-kafka.ts",
};

async function loadKit(file: string): Promise<AnyKit> {
  const module = (await import(/* @vite-ignore */ path.resolve(file))) as {
    default: AnyKit;
  };
  return module.default;
}

/** Basic ATK, Blast Skill, AoE Ultimate, and a follow-up: triggers most effects. */
function genericAttacker(id: string): CharacterKitDefinition {
  return defineCharacter(id, (k) => {
    k.ability({
      id: "basic",
      kind: "basic",
      hits: [{ shape: "single", main: 1, toughness: { main: 10 } }],
    });
    k.ability({
      id: "skill",
      kind: "skill",
      hits: [
        {
          shape: "blast",
          main: 2,
          adjacent: 1,
          toughness: { main: 20, adjacent: 10 },
        },
      ],
      after: (ctx) => ctx.queueAction(ctx.self, "followUp"),
    });
    k.ability({
      id: "followUp",
      kind: "followUp",
      energy: 5,
      hits: [{ shape: "single", main: 1, toughness: { main: 10 } }],
    });
    k.ability({
      id: "ultimate",
      kind: "ultimate",
      hits: [{ shape: "aoe", each: 2, toughness: { each: 20 } }],
    });
  });
}

async function lightConeWearer(
  pathId: string | undefined
): Promise<CharacterKitDefinition> {
  const file = process.env.WEARER ?? (pathId && PATH_WEARERS[pathId]);
  if (file) {
    const kit = await loadKit(file);
    if (kit.type !== "character") throw new Error(`${file} is not a Character`);
    return kit;
  }
  const character = [...data.characters.values()].find(
    (entry) => entry.path_id === pathId
  );
  return genericAttacker(character?.id ?? "1102");
}

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
    const kit = await loadKit(file);
    const fileId = /(\d+)-[^/]+\.ts$/.exec(file)?.[1];
    expect(kit.id).toBe(fileId);
    let wearer: CharacterKitDefinition | null = null;
    if (kit.type === "lightCone") {
      wearer = await lightConeWearer(data.lightCones.get(kit.id)?.path_id);
    } else if (kit.type === "relicSet") {
      const chosen = process.env.WEARER
        ? await loadKit(process.env.WEARER)
        : genericAttacker("1102");
      if (chosen.type === "character") wearer = chosen;
    }
    // The wearer comes first so it replaces a reference kit with its ID.
    const characters = [...(wearer ? [wearer] : []), seele, robin, kafka]
      .filter((entry) => entry.id !== kit.id)
      .filter(
        (entry, index, all) =>
          all.findIndex((other) => other.id === entry.id) === index
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
        member(wearer?.id ?? "1102", {
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
