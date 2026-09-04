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

function distinctInstanceKey(
  preferredKey: string,
  records: readonly { key: string }[]
): string {
  const existingKeys = new Set(records.map((record) => record.key));
  if (!existingKeys.has(preferredKey)) return preferredKey;

  for (let ordinal = 1; ; ordinal += 1) {
    const suffix = `:merge:${ordinal}`;
    const candidate = `${preferredKey.slice(0, 128 - suffix.length)}${suffix}`;
    if (!existingKeys.has(candidate)) return candidate;
  }
}

function visibleLightConeFingerprint(lightCone: LightCone): string {
  return JSON.stringify({
    definitionId: lightCone.definitionId,
    pathId: lightCone.pathId,
    level: lightCone.level,
    ascension: lightCone.ascension,
    superimposition: lightCone.superimposition,
  });
}

function withoutLightConeAssignment(lightCone: LightCone): LightCone {
  const { equippedCharacterKey: _equippedCharacterKey, ...unequipped } =
    lightCone;
  return unequipped;
}

function planCurrentRecordMatches<T extends { key: string }>(
  current: readonly T[],
  incoming: readonly T[],
  sameVisibleIdentity: (left: T, right: T) => boolean,
  sameEquippedTarget: (left: T, right: T) => boolean
): readonly (number | null)[] {
  // `current` is the frozen candidate pool for this import pass. Records that
  // are appended while applying the plan become eligible only on a later import.
  const plannedMatches = Array<number | null>(incoming.length).fill(null);
  const consumedCurrentIndexes = new Set<number>();

  function claimUniqueMatch(
    sourceIndex: number,
    predicate: (candidate: T) => boolean
  ): void {
    if (plannedMatches[sourceIndex] !== null) return;
    const matches: number[] = [];
    for (
      let candidateIndex = 0;
      candidateIndex < current.length;
      candidateIndex += 1
    ) {
      const candidate = current[candidateIndex];
      if (
        candidate &&
        !consumedCurrentIndexes.has(candidateIndex) &&
        predicate(candidate)
      ) {
        matches.push(candidateIndex);
      }
    }
    if (matches.length !== 1) return;
    const [match] = matches;
    if (match === undefined) return;
    plannedMatches[sourceIndex] = match;
    consumedCurrentIndexes.add(match);
  }

  // Resolve strong identities for the entire batch before allowing a weaker
  // visible-only match to consume a record needed by a later incoming item.
  incoming.forEach((source, sourceIndex) => {
    claimUniqueMatch(
      sourceIndex,
      (candidate) =>
        candidate.key === source.key && sameVisibleIdentity(candidate, source)
    );
  });
  incoming.forEach((source, sourceIndex) => {
    claimUniqueMatch(
      sourceIndex,
      (candidate) =>
        sameEquippedTarget(candidate, source) &&
        sameVisibleIdentity(candidate, source)
    );
  });
  incoming.forEach((source, sourceIndex) => {
    claimUniqueMatch(sourceIndex, (candidate) =>
      sameVisibleIdentity(candidate, source)
    );
  });

  return plannedMatches;
}

function mergeLightCones(
  current: readonly LightCone[],
  incoming: readonly LightCone[],
  incomingKeyMap: ReadonlyMap<string, string>
): LightCone[] {
  const merged = [...current];
  const normalizedIncoming = incoming.map((source) => {
    const { equippedCharacterKey: sourceCharacterKey, ...sourceWithoutEquip } =
      source;
    const equippedCharacterKey = remapCharacterKey(
      sourceCharacterKey,
      incomingKeyMap
    );
    return {
      ...sourceWithoutEquip,
      ...(equippedCharacterKey ? { equippedCharacterKey } : {}),
    };
  });
  const plannedMatches = planCurrentRecordMatches(
    current,
    normalizedIncoming,
    (left, right) =>
      visibleLightConeFingerprint(left) === visibleLightConeFingerprint(right),
    (left, right) =>
      right.equippedCharacterKey !== undefined &&
      left.equippedCharacterKey === right.equippedCharacterKey
  );

  normalizedIncoming.forEach((lightCone, sourceIndex) => {
    const equippedCharacterKey = lightCone.equippedCharacterKey;
    const index = plannedMatches[sourceIndex] ?? -1;

    if (equippedCharacterKey) {
      for (
        let candidateIndex = 0;
        candidateIndex < merged.length;
        candidateIndex += 1
      ) {
        const candidate = merged[candidateIndex];
        if (
          candidateIndex !== index &&
          candidate?.equippedCharacterKey === equippedCharacterKey
        ) {
          merged[candidateIndex] = withoutLightConeAssignment(candidate);
        }
      }
    }

    if (index < 0) {
      merged.push({
        ...lightCone,
        key: distinctInstanceKey(lightCone.key, merged),
      });
      return;
    }
    const existing = merged[index];
    if (!existing) return;
    merged[index] = {
      ...existing,
      ...lightCone,
      key: existing.key,
      locked: lightCone.locked ?? existing.locked,
    };
  });
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

function withoutRelicAssignment(relic: Relic): Relic {
  const { equippedCharacterKey: _equippedCharacterKey, ...unequipped } = relic;
  return unequipped;
}

function mergeRelics(
  current: readonly Relic[],
  incoming: readonly Relic[],
  incomingKeyMap: ReadonlyMap<string, string>
): Relic[] {
  const merged = [...current];
  const normalizedIncoming = incoming.map((source) => {
    const { equippedCharacterKey: sourceCharacterKey, ...sourceWithoutEquip } =
      source;
    const equippedCharacterKey = remapCharacterKey(
      sourceCharacterKey,
      incomingKeyMap
    );
    return {
      ...sourceWithoutEquip,
      ...(equippedCharacterKey ? { equippedCharacterKey } : {}),
    };
  });
  const plannedMatches = planCurrentRecordMatches(
    current,
    normalizedIncoming,
    (left, right) =>
      visibleRelicFingerprint(left) === visibleRelicFingerprint(right),
    (left, right) =>
      right.equippedCharacterKey !== undefined &&
      left.equippedCharacterKey === right.equippedCharacterKey &&
      left.slot === right.slot
  );

  normalizedIncoming.forEach((relic, sourceIndex) => {
    const equippedCharacterKey = relic.equippedCharacterKey;
    const index = plannedMatches[sourceIndex] ?? -1;

    if (equippedCharacterKey) {
      for (
        let candidateIndex = 0;
        candidateIndex < merged.length;
        candidateIndex += 1
      ) {
        const candidate = merged[candidateIndex];
        if (
          candidateIndex !== index &&
          candidate?.equippedCharacterKey === equippedCharacterKey &&
          candidate.slot === relic.slot
        ) {
          merged[candidateIndex] = withoutRelicAssignment(candidate);
        }
      }
    }

    if (index < 0) {
      merged.push({
        ...relic,
        key: distinctInstanceKey(relic.key, merged),
      });
      return;
    }
    const existing = merged[index];
    if (!existing) return;
    merged[index] = {
      ...existing,
      ...relic,
      key: existing.key,
      locked: relic.locked ?? existing.locked,
      discarded: relic.discarded ?? existing.discarded,
    };
  });
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
    ...(incoming.achievementCompletion !== undefined
      ? { achievementCompletion: incoming.achievementCompletion }
      : current.achievementCompletion !== undefined
        ? { achievementCompletion: current.achievementCompletion }
        : {}),
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
