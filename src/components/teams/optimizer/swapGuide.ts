import type { AccountSnapshot, Relic } from "@/domain/game-account/schemas";
import {
  RELIC_SLOTS,
  type RelicSlotId,
} from "@/services/catalog/relicPresentation";
import { ownedCharacter } from "@/services/combat/accountTeam";

/** Where a recommended Relic comes from. */
export type SwapStatus =
  | { readonly kind: "equipped" }
  | { readonly kind: "swap"; readonly fromCharacterId: string }
  | { readonly kind: "inventory" };

export interface SwapRow {
  readonly slot: RelicSlotId;
  /** The recommended Relic; null when the loadout leaves the slot empty. */
  readonly relic: Relic | null;
  readonly status: SwapStatus | null;
  /** Another member's recommended loadout claims the same Relic. */
  readonly conflict: boolean;
}

export interface SwapColumn {
  readonly teamSlot: number;
  readonly characterId: string;
  readonly rows: readonly SwapRow[];
}

export interface SwapGuide {
  readonly columns: readonly SwapColumn[];
  /** Rows whose Relic the member does not already wear. */
  readonly changes: number;
}

export interface SwapGuideMember {
  readonly teamSlot: number;
  readonly characterId: string;
  /** The recommended loadout, by Relic slot. */
  readonly relicKeys: Readonly<Record<string, string>>;
}

/**
 * Compares each member's recommended loadout with what the account's
 * Characters wear: already equipped, taken from another Character, or taken
 * from the inventory. A Relic recommended to two members is a conflict.
 */
export function buildSwapGuide(
  members: readonly SwapGuideMember[],
  account: AccountSnapshot | null
): SwapGuide {
  const relicByKey = new Map(
    (account?.relics ?? []).map((relic) => [relic.key, relic])
  );
  const characterByKey = new Map(
    (account?.characters ?? []).map((character) => [character.key, character])
  );
  const claims = new Map<string, number>();
  for (const member of members)
    for (const key of Object.values(member.relicKeys))
      if (key) claims.set(key, (claims.get(key) ?? 0) + 1);

  let changes = 0;
  const columns = members.map((member): SwapColumn => {
    const wearerKey = ownedCharacter(account, member.characterId)?.key;
    const rows = RELIC_SLOTS.map((slot): SwapRow => {
      const key = member.relicKeys[slot];
      const relic = key ? (relicByKey.get(key) ?? null) : null;
      if (!relic) return { slot, relic: null, status: null, conflict: false };
      const equippedBy = relic.equippedCharacterKey;
      const status: SwapStatus =
        equippedBy && equippedBy === wearerKey
          ? { kind: "equipped" }
          : equippedBy && characterByKey.has(equippedBy)
            ? {
                kind: "swap",
                fromCharacterId:
                  characterByKey.get(equippedBy)?.definitionId ?? "",
              }
            : { kind: "inventory" };
      if (status.kind !== "equipped") changes += 1;
      return {
        slot,
        relic,
        status,
        conflict: (claims.get(relic.key) ?? 0) > 1,
      };
    });
    return {
      teamSlot: member.teamSlot,
      characterId: member.characterId,
      rows,
    };
  });
  return { columns, changes };
}
