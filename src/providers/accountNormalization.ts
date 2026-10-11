import type { RelicSlot } from "@/domain/account/schemas";
import {
  decimalToAccountStat,
  RELIC_SLOT_BY_CATALOG_SLOT,
} from "@/domain/stats";
import type {
  CharacterStatScaling,
  LightConeStatScaling,
  PropertyDefinition,
  RelicSlotId,
} from "@/providers/reference/types";

export function accountRelicSlot(slot: RelicSlotId): RelicSlot {
  return RELIC_SLOT_BY_CATALOG_SLOT[slot];
}

export function accountStatValue(
  property: PropertyDefinition,
  sourceValue: number
): number {
  const value = decimalToAccountStat(sourceValue, property.value_kind);
  return Number(value.toFixed(3));
}

export function inferPromotion(
  level: number,
  scaling: readonly (CharacterStatScaling | LightConeStatScaling)[]
): number {
  const ordered = [...scaling].sort(
    (left, right) => left.ascension - right.ascension
  );
  return (
    ordered.find((promotion) => level <= promotion.max_level)?.ascension ??
    ordered.at(-1)?.ascension ??
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
