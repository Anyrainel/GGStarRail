import type {
  ProgressionTables,
  RelicPieceDefinition,
  RelicSlotId,
} from "@/providers/gilore/types";

export interface VisibleRelicIdentityCatalog {
  relicPieces: readonly RelicPieceDefinition[];
  progression: ProgressionTables;
}

export interface VisibleRelicObservation {
  setId: string;
  slot: RelicSlotId;
  rarity: number;
  mainPropertyId: string;
}

function visibleDefinitionSignature(piece: RelicPieceDefinition): string {
  return JSON.stringify({
    setId: piece.set_id,
    slot: piece.slot,
    rarity: piece.rarity,
    name: {
      en: piece.name.en.value,
      zhCn: piece.name["zh-CN"].value,
    },
    iconPath: piece.icon_path,
  });
}

function mainProgressionSignature(
  piece: RelicPieceDefinition,
  mainPropertyId: string,
  progression: ProgressionTables
): string | null {
  const affix = progression.relic_main_affixes.find(
    (candidate) =>
      candidate.group_id === piece.main_affix_group &&
      candidate.property_id === mainPropertyId
  );
  if (!affix || affix.max_level !== piece.max_level) return null;
  return JSON.stringify({
    maxLevel: affix.max_level,
    levelValues: affix.level_values,
  });
}

function comparePublicIds(left: string, right: string): number {
  return left.length - right.length || left.localeCompare(right);
}

/**
 * Resolves the public RelicConfig identity that a visible capture can prove.
 *
 * Some 4-star definitions have identical localized name, icon, set, slot,
 * rarity, and main-stat progression. Those records are observationally
 * equivalent to OCR and v4 imports, so the lowest numeric public definition ID
 * is the canonical identity. A supplied public ID only selects an equivalence
 * class; it does not override that canonicalization.
 */
export function canonicalVisibleRelicPiece(
  observation: VisibleRelicObservation,
  catalog: VisibleRelicIdentityCatalog,
  suppliedPiece?: RelicPieceDefinition
): RelicPieceDefinition {
  if (
    suppliedPiece &&
    (suppliedPiece.set_id !== observation.setId ||
      suppliedPiece.slot !== observation.slot ||
      suppliedPiece.rarity !== observation.rarity)
  ) {
    throw new Error(
      `Relic ${suppliedPiece.id} does not match its visible set, slot, and rarity`
    );
  }
  const baseCandidates = catalog.relicPieces.filter(
    (piece) =>
      piece.set_id === observation.setId &&
      piece.slot === observation.slot &&
      piece.rarity === observation.rarity
  );
  const suppliedVisibleSignature = suppliedPiece
    ? visibleDefinitionSignature(suppliedPiece)
    : null;
  const candidates = baseCandidates.filter(
    (piece) =>
      suppliedVisibleSignature === null ||
      visibleDefinitionSignature(piece) === suppliedVisibleSignature
  );
  const compatible = candidates.flatMap((piece) => {
    const progressionSignature = mainProgressionSignature(
      piece,
      observation.mainPropertyId,
      catalog.progression
    );
    return progressionSignature ? [{ piece, progressionSignature }] : [];
  });
  if (compatible.length === 0) {
    throw new Error(
      `Unknown visible Relic identity: set ${observation.setId}, slot ${observation.slot}, rarity ${observation.rarity}, main stat ${observation.mainPropertyId}`
    );
  }

  const expectedProgression = suppliedPiece
    ? mainProgressionSignature(
        suppliedPiece,
        observation.mainPropertyId,
        catalog.progression
      )
    : compatible[0]?.progressionSignature;
  if (!expectedProgression) {
    throw new Error(
      `Relic ${suppliedPiece?.id ?? "capture"} has no compatible main-stat progression`
    );
  }
  const visibleSignatures = new Set(
    compatible.map(({ piece }) => visibleDefinitionSignature(piece))
  );
  const progressionSignatures = new Set(
    compatible.map(({ progressionSignature }) => progressionSignature)
  );
  if (
    suppliedPiece === undefined &&
    (visibleSignatures.size !== 1 || progressionSignatures.size !== 1)
  ) {
    throw new Error(
      `Ambiguous visible Relic identity: set ${observation.setId}, slot ${observation.slot}, rarity ${observation.rarity}, main stat ${observation.mainPropertyId}`
    );
  }

  const equivalent = compatible
    .filter(
      ({ progressionSignature }) => progressionSignature === expectedProgression
    )
    .map(({ piece }) => piece)
    .sort((left, right) => comparePublicIds(left.id, right.id));
  const canonical = equivalent[0];
  if (!canonical) {
    throw new Error(
      `Relic ${suppliedPiece?.id ?? "capture"} does not match its visible main-stat progression`
    );
  }
  return canonical;
}
