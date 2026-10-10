import type {
  AccountSnapshot,
  Character,
  Relic,
} from "@/domain/account/schemas";
import { canonicalCharacterId } from "@/domain/characterIdentity";
import { loadoutOf, type RelicPiece } from "@/domain/combat/optimize/relics";
import type { MemberInput, RelicLoadout } from "@/domain/combat/team/input";
import { accountStatToDecimal, type StatValueKind } from "@/domain/stats";

export interface PropertyKinds {
  get(propertyId: string): { value_kind: StatValueKind } | undefined;
}

/** An account Relic as decimal stats for the optimizer. */
export function relicPiece(
  relic: Relic,
  properties: PropertyKinds
): RelicPiece {
  const stats: Record<string, number> = {};
  for (const stat of [relic.mainStat, ...relic.substats]) {
    const kind = properties.get(stat.statId)?.value_kind ?? "flat";
    stats[stat.statId] =
      (stats[stat.statId] ?? 0) + accountStatToDecimal(stat.value, kind);
  }
  return {
    key: relic.key,
    slot: relic.slot,
    setId: relic.setId,
    mainStat: relic.mainStat.statId,
    stats,
  };
}

export function equippedLoadout(
  account: AccountSnapshot,
  character: Character,
  properties: PropertyKinds
): RelicLoadout {
  const relics = new Map(account.relics.map((relic) => [relic.key, relic]));
  const pieces: Partial<Record<RelicPiece["slot"], RelicPiece>> = {};
  for (const key of character.relicKeys) {
    const relic = relics.get(key);
    if (relic) pieces[relic.slot] = relicPiece(relic, properties);
  }
  return loadoutOf(pieces);
}

/**
 * Team member input from an owned Character: level, Eidolon, Traces, the
 * equipped Light Cone, and equipped Relics come from the account.
 */
export function accountMember(
  account: AccountSnapshot,
  character: Character,
  properties: PropertyKinds
): MemberInput {
  const lightCone = character.lightConeKey
    ? account.lightCones.find((entry) => entry.key === character.lightConeKey)
    : undefined;
  return {
    characterId: character.definitionId,
    level: character.level,
    ascension: character.ascension,
    eidolon: character.eidolon,
    traces: character.traces,
    lightCone: lightCone
      ? {
          id: lightCone.definitionId,
          level: lightCone.level,
          ascension: lightCone.ascension,
          superimposition: lightCone.superimposition,
        }
      : null,
    relics: equippedLoadout(account, character, properties),
  };
}

/** The owned instance of a catalog Character (Trailblazer forms included). */
export function ownedCharacter(
  account: AccountSnapshot | null,
  characterId: string
): Character | undefined {
  const canonical = canonicalCharacterId(characterId);
  return account?.characters.find(
    (character) => canonicalCharacterId(character.definitionId) === canonical
  );
}
