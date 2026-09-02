import type { AccountSnapshot, RelicSlot } from "@/domain/account/schemas";
import type {
  CharacterDefinition,
  HsrReferenceCatalog,
  LightConeDefinition,
  ProgressionTables,
} from "@/providers/gilore/types";
import { validateRelicMainStatDisplayValue } from "@/providers/relicMainStat";

type NativeScannerCatalog = Pick<
  HsrReferenceCatalog,
  "characters" | "lightCones" | "relicSets" | "relicPieces" | "properties"
> & { progression: ProgressionTables };

const CATALOG_SLOT_TO_DOMAIN = {
  HEAD: "head",
  HAND: "hands",
  BODY: "body",
  FOOT: "feet",
  NECK: "planarSphere",
  OBJECT: "linkRope",
} as const satisfies Record<
  HsrReferenceCatalog["relicPieces"][number]["slot"],
  RelicSlot
>;

function requiredDefinition<T extends { id: string }>(
  definitions: ReadonlyMap<string, T>,
  id: string,
  label: string
): T {
  const definition = definitions.get(id);
  if (!definition) {
    throw new Error(`Unknown ${label} definition: ${id}`);
  }
  return definition;
}

function validatePromotionLevel(
  label: string,
  definition: CharacterDefinition | LightConeDefinition,
  ascension: number,
  level: number
): void {
  if (ascension > definition.max_promotion) {
    throw new Error(
      `${label} ascension ${ascension} exceeds definition ${definition.id} maximum ${definition.max_promotion}`
    );
  }
  const promotion = definition.promotions.find(
    (candidate) => candidate.promotion === ascension
  );
  if (!promotion) {
    throw new Error(
      `${label} definition ${definition.id} has no ascension ${ascension} progression`
    );
  }
  if (level > promotion.max_level) {
    throw new Error(
      `${label} level ${level} exceeds definition ${definition.id} ascension ${ascension} maximum ${promotion.max_level}`
    );
  }
  if (ascension === 0) return;
  const previousPromotion = definition.promotions.find(
    (candidate) => candidate.promotion === ascension - 1
  );
  if (!previousPromotion) {
    throw new Error(
      `${label} definition ${definition.id} has incomplete ascension progression`
    );
  }
  if (level < previousPromotion.max_level) {
    throw new Error(
      `${label} level ${level} is below definition ${definition.id} ascension ${ascension} minimum ${previousPromotion.max_level}`
    );
  }
}

export function validateNativeScannerAccount(
  account: AccountSnapshot,
  catalog: NativeScannerCatalog
): void {
  const characterById = new Map(
    catalog.characters.map((definition) => [definition.id, definition])
  );
  const lightConeById = new Map(
    catalog.lightCones.map((definition) => [definition.id, definition])
  );
  const relicSetById = new Map(
    catalog.relicSets.map((definition) => [definition.id, definition])
  );
  const relicPieceById = new Map(
    catalog.relicPieces.map((definition) => [definition.id, definition])
  );
  const propertyById = new Map(
    catalog.properties.map((definition) => [definition.id, definition])
  );

  for (const character of account.characters) {
    const definition = requiredDefinition(
      characterById,
      character.definitionId,
      "Character"
    );
    if (character.pathId !== definition.path_id) {
      throw new Error(
        `Character path ${character.pathId} does not match definition ${definition.id}`
      );
    }
    if (character.combatTypeId !== definition.combat_type_id) {
      throw new Error(
        `Character Combat Type ${character.combatTypeId} does not match definition ${definition.id}`
      );
    }
    if (character.eidolon > definition.max_rank) {
      throw new Error(
        `Character Eidolon ${character.eidolon} exceeds definition ${definition.id} maximum ${definition.max_rank}`
      );
    }
    validatePromotionLevel(
      "Character",
      definition,
      character.ascension,
      character.level
    );
  }

  for (const lightCone of account.lightCones) {
    const definition = requiredDefinition(
      lightConeById,
      lightCone.definitionId,
      "Light Cone"
    );
    if (lightCone.pathId !== definition.path_id) {
      throw new Error(
        `Light Cone path ${lightCone.pathId} does not match definition ${definition.id}`
      );
    }
    if (lightCone.superimposition > definition.max_superimposition) {
      throw new Error(
        `Light Cone Superimposition ${lightCone.superimposition} exceeds definition ${definition.id} maximum ${definition.max_superimposition}`
      );
    }
    validatePromotionLevel(
      "Light Cone",
      definition,
      lightCone.ascension,
      lightCone.level
    );
  }

  for (const relic of account.relics) {
    const definition = requiredDefinition(
      relicPieceById,
      relic.definitionId,
      "Relic"
    );
    requiredDefinition(relicSetById, relic.setId, "Relic set");
    if (relic.setId !== definition.set_id) {
      throw new Error(
        `Relic set ${relic.setId} does not match definition ${definition.id}`
      );
    }
    const expectedSlot = CATALOG_SLOT_TO_DOMAIN[definition.slot];
    if (relic.slot !== expectedSlot) {
      throw new Error(
        `Relic slot ${relic.slot} does not match definition ${definition.id}`
      );
    }
    if (relic.rarity !== definition.rarity) {
      throw new Error(
        `Relic rarity ${relic.rarity} does not match definition ${definition.id}`
      );
    }
    if (relic.level > definition.max_level) {
      throw new Error(
        `Relic level ${relic.level} exceeds definition ${definition.id} maximum ${definition.max_level}`
      );
    }

    validateRelicMainStatDisplayValue(
      definition,
      relic.mainStat,
      relic.level,
      catalog.properties,
      catalog.progression.relic_main_affixes
    );

    for (const substat of relic.substats) {
      requiredDefinition(propertyById, substat.statId, "Relic property");
      const supported = catalog.progression.relic_sub_affixes.some(
        (candidate) =>
          candidate.group_id === definition.sub_affix_group &&
          candidate.property_id === substat.statId
      );
      if (!supported) {
        throw new Error(
          `Relic substat ${substat.statId} is incompatible with definition ${definition.id}`
        );
      }
    }
  }
}
