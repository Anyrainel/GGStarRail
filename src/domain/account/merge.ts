import {
  type AccountSnapshot,
  AccountSnapshotSchema,
  type Character,
  type LightCone,
  type Relic,
} from "./schemas";

interface CharacterMerge {
  characters: Character[];
  incomingKeyMap: ReadonlyMap<string, string>;
}

export type AccountIdentityResolution =
  | "empty-workspace"
  | "same-uid"
  | "different-uid"
  | "unknown-identity";

export type AccountImportMode = "merge" | "replace";

export function resolveAccountImportIdentity(
  current: AccountSnapshot | null,
  incoming: AccountSnapshot
): AccountIdentityResolution {
  if (!current) return "empty-workspace";
  if (!current.uid || !incoming.uid) return "unknown-identity";
  return current.uid === incoming.uid ? "same-uid" : "different-uid";
}

function mergeCharacters(
  current: readonly Character[],
  incoming: readonly Character[]
): CharacterMerge {
  const byDefinition = new Map(
    current.map((character) => [character.definitionId, character])
  );
  const incomingKeyMap = new Map<string, string>();
  for (const character of incoming) {
    const existing = byDefinition.get(character.definitionId);
    const key = existing?.key ?? character.key;
    incomingKeyMap.set(character.key, key);
    byDefinition.set(character.definitionId, {
      ...existing,
      ...character,
      key,
      traces: { ...existing?.traces, ...character.traces },
      relicKeys: existing?.relicKeys ?? character.relicKeys,
      lightConeKey: existing?.lightConeKey ?? character.lightConeKey,
    });
  }
  return { characters: [...byDefinition.values()], incomingKeyMap };
}

function remapCharacterKey(
  key: string | undefined,
  incomingKeyMap: ReadonlyMap<string, string>
): string | undefined {
  return key ? (incomingKeyMap.get(key) ?? key) : undefined;
}

function mergeLightCones(
  current: readonly LightCone[],
  incoming: readonly LightCone[],
  incomingKeyMap: ReadonlyMap<string, string>
): LightCone[] {
  const merged = [...current];
  for (const source of incoming) {
    const lightCone = {
      ...source,
      equippedCharacterKey: remapCharacterKey(
        source.equippedCharacterKey,
        incomingKeyMap
      ),
    };
    const byKey = merged.findIndex(
      (candidate) => candidate.key === lightCone.key
    );
    const equippedMatch = lightCone.equippedCharacterKey
      ? merged
          .map((candidate, index) => ({ candidate, index }))
          .filter(
            ({ candidate }) =>
              candidate.equippedCharacterKey === lightCone.equippedCharacterKey
          )
      : [];
    const index =
      byKey >= 0
        ? byKey
        : equippedMatch.length === 1
          ? (equippedMatch[0]?.index ?? -1)
          : -1;
    if (index < 0) {
      merged.push(lightCone);
      continue;
    }
    const existing = merged[index];
    if (!existing) continue;
    merged[index] = {
      ...existing,
      ...lightCone,
      key: existing.key,
      locked: lightCone.locked ?? existing.locked,
    };
  }
  return merged;
}

function visibleRelicFingerprint(relic: Relic): string {
  return JSON.stringify({
    definitionId: relic.definitionId,
    setId: relic.setId,
    slot: relic.slot,
    rarity: relic.rarity,
    level: relic.level,
    mainStat: relic.mainStat,
    substats: [...relic.substats].sort((left, right) =>
      left.statId.localeCompare(right.statId)
    ),
  });
}

function mergeRelics(
  current: readonly Relic[],
  incoming: readonly Relic[],
  incomingKeyMap: ReadonlyMap<string, string>
): Relic[] {
  const merged = [...current];
  for (const source of incoming) {
    const relic = {
      ...source,
      equippedCharacterKey: remapCharacterKey(
        source.equippedCharacterKey,
        incomingKeyMap
      ),
    };
    const byKey = merged.findIndex((candidate) => candidate.key === relic.key);
    const equippedMatches = relic.equippedCharacterKey
      ? merged
          .map((candidate, index) => ({ candidate, index }))
          .filter(
            ({ candidate }) =>
              candidate.equippedCharacterKey === relic.equippedCharacterKey &&
              candidate.slot === relic.slot
          )
      : [];
    const fingerprint = visibleRelicFingerprint(relic);
    const visibleMatches = relic.equippedCharacterKey
      ? merged
          .map((candidate, index) => ({ candidate, index }))
          .filter(
            ({ candidate }) =>
              visibleRelicFingerprint(candidate) === fingerprint
          )
      : [];
    const index =
      byKey >= 0
        ? byKey
        : equippedMatches.length === 1
          ? (equippedMatches[0]?.index ?? -1)
          : visibleMatches.length === 1
            ? (visibleMatches[0]?.index ?? -1)
            : -1;
    if (index < 0) {
      merged.push(relic);
      continue;
    }
    const existing = merged[index];
    if (!existing) continue;
    merged[index] = {
      ...existing,
      ...relic,
      key: existing.key,
      locked: relic.locked ?? existing.locked,
      discarded: relic.discarded ?? existing.discarded,
    };
  }
  return merged;
}

function rebuildCharacterEquipment(
  characters: readonly Character[],
  lightCones: readonly LightCone[],
  relics: readonly Relic[]
): Character[] {
  return characters.map((character) => ({
    ...character,
    lightConeKey: lightCones.find(
      (lightCone) => lightCone.equippedCharacterKey === character.key
    )?.key,
    relicKeys: relics
      .filter((relic) => relic.equippedCharacterKey === character.key)
      .map((relic) => relic.key),
  }));
}

function mergeAccountSections(
  current: AccountSnapshot,
  incoming: AccountSnapshot
): AccountSnapshot {
  const coverage = incoming.source.coverage;
  const characterMerge = mergeCharacters(
    current.characters,
    incoming.characters
  );
  const lightCones =
    coverage.lightCones === "complete"
      ? mergeLightCones([], incoming.lightCones, characterMerge.incomingKeyMap)
      : mergeLightCones(
          current.lightCones,
          incoming.lightCones,
          characterMerge.incomingKeyMap
        );
  const relics =
    coverage.relics === "complete"
      ? mergeRelics([], incoming.relics, characterMerge.incomingKeyMap)
      : mergeRelics(
          current.relics,
          incoming.relics,
          characterMerge.incomingKeyMap
        );
  const characters = rebuildCharacterEquipment(
    coverage.characters === "complete"
      ? characterMerge.characters.filter((character) =>
          incoming.characters.some(
            (candidate) => candidate.definitionId === character.definitionId
          )
        )
      : characterMerge.characters,
    lightCones,
    relics
  );

  return AccountSnapshotSchema.parse({
    ...incoming,
    profileId: current.profileId,
    uid: incoming.uid ?? current.uid,
    region: incoming.region ?? current.region,
    nickname: incoming.nickname ?? current.nickname,
    trailblazeLevel: incoming.trailblazeLevel ?? current.trailblazeLevel,
    characters,
    lightCones,
    relics,
    source: {
      ...incoming.source,
      warnings: [
        ...new Set([
          ...incoming.source.warnings,
          "PARTIAL_IMPORT_MERGED_WITH_LOCAL_DATA",
        ]),
      ],
    },
  });
}

export function applyAccountImport(
  current: AccountSnapshot | null,
  incoming: AccountSnapshot,
  mode: AccountImportMode
): AccountSnapshot {
  const identity = resolveAccountImportIdentity(current, incoming);
  if (mode === "replace" || identity === "empty-workspace") {
    return AccountSnapshotSchema.parse(incoming);
  }
  if (!current) return AccountSnapshotSchema.parse(incoming);
  if (identity === "different-uid") {
    throw new Error("ACCOUNT_IMPORT_DIFFERENT_UID_REQUIRES_REPLACEMENT");
  }
  return mergeAccountSections(current, incoming);
}
