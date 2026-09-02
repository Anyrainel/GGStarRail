import type { RelicSlot } from "@/domain/account/schemas";
import type {
  CharacterPromotion,
  LightConePromotion,
  PropertyDefinition,
  RelicSlotId,
} from "@/providers/gilore/types";

const CATALOG_SLOT_TO_ACCOUNT = {
  HEAD: "head",
  HAND: "hands",
  BODY: "body",
  FOOT: "feet",
  NECK: "planarSphere",
  OBJECT: "linkRope",
} as const satisfies Record<RelicSlotId, RelicSlot>;

export function accountRelicSlot(slot: RelicSlotId): RelicSlot {
  return CATALOG_SLOT_TO_ACCOUNT[slot];
}

export function accountStatValue(
  property: PropertyDefinition,
  sourceValue: number
): number {
  const value =
    property.value_kind === "ratio" ? sourceValue * 100 : sourceValue;
  return Number(value.toFixed(3));
}

export function inferPromotion(
  level: number,
  promotions: readonly (CharacterPromotion | LightConePromotion)[]
): number {
  const ordered = [...promotions].sort(
    (left, right) => left.promotion - right.promotion
  );
  return (
    ordered.find((promotion) => level <= promotion.max_level)?.promotion ??
    ordered.at(-1)?.promotion ??
    0
  );
}

export function accountProfileKey(uid: string): string {
  return `account:${uid}`;
}

export function accountCharacterKey(uid: string, characterId: string): string {
  return `${accountProfileKey(uid)}:character:${characterId}`;
}

export function accountLightConeKey(uid: string, characterId: string): string {
  return `${accountProfileKey(uid)}:light-cone:${characterId}`;
}

export function accountRelicKey(
  uid: string,
  characterId: string,
  slot: RelicSlot
): string {
  return `${accountProfileKey(uid)}:relic:${characterId}:${slot}`;
}

export function starRailServerForUid(uid: string): string | null {
  const servers: Readonly<Record<string, string>> = {
    "1": "prod_gf_cn",
    "2": "prod_gf_cn",
    "5": "prod_qd_cn",
    "6": "prod_official_usa",
    "7": "prod_official_eur",
    "8": "prod_official_asia",
    "9": "prod_official_cht",
  };
  return /^\d{9}$/.test(uid) ? (servers[uid[0] ?? ""] ?? null) : null;
}
