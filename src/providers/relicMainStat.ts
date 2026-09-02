import type {
  MainAffixDefinition,
  PropertyDefinition,
  RelicPieceDefinition,
} from "./gilore/types";

function requiredProperty(
  properties: readonly PropertyDefinition[],
  propertyId: string
): PropertyDefinition {
  const property = properties.find((candidate) => candidate.id === propertyId);
  if (!property) {
    throw new Error(`Unknown Relic property definition: ${propertyId}`);
  }
  return property;
}

export function generatedRelicMainStatDisplayValues(
  piece: RelicPieceDefinition,
  propertyId: string,
  level: number,
  properties: readonly PropertyDefinition[],
  mainAffixes: readonly MainAffixDefinition[]
): {
  exact: number;
  normalized: number;
  uiRounded: number;
} {
  const property = requiredProperty(properties, propertyId);
  const affix = mainAffixes.find(
    (candidate) =>
      candidate.group_id === piece.main_affix_group &&
      candidate.property_id === propertyId &&
      candidate.max_level === piece.max_level
  );
  if (!affix) {
    throw new Error(
      `Relic main stat ${propertyId} is incompatible with definition ${piece.id}`
    );
  }
  if (!Number.isInteger(level) || level < 0 || level > piece.max_level) {
    throw new Error(
      `Relic level ${level} exceeds definition ${piece.id} range 0..${piece.max_level}`
    );
  }
  const generatedValue = affix.level_values[level];
  if (generatedValue === undefined) {
    throw new Error(
      `Missing generated main-stat value for Relic ${piece.id} at level ${level}`
    );
  }

  const exact =
    property.value_kind === "ratio" ? generatedValue * 100 : generatedValue;
  return {
    exact,
    normalized: Number(exact.toFixed(3)),
    uiRounded: Number(exact.toFixed(1)),
  };
}

export function validateRelicMainStatDisplayValue(
  piece: RelicPieceDefinition,
  mainStat: { statId: string; value: number },
  level: number,
  properties: readonly PropertyDefinition[],
  mainAffixes: readonly MainAffixDefinition[]
): void {
  const expected = generatedRelicMainStatDisplayValues(
    piece,
    mainStat.statId,
    level,
    properties,
    mainAffixes
  );
  const approximatelyEquals = (left: number, right: number) =>
    Math.abs(left - right) <= 1e-6;
  if (
    approximatelyEquals(mainStat.value, expected.exact) ||
    approximatelyEquals(mainStat.value, expected.normalized) ||
    approximatelyEquals(mainStat.value, expected.uiRounded)
  ) {
    return;
  }
  throw new Error(
    `Relic main stat value ${mainStat.value} does not match generated value ${expected.exact} or UI value ${expected.uiRounded} for definition ${piece.id} at level ${level}`
  );
}
