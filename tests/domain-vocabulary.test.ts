import { describe, expect, it } from "vitest";
import {
  abilityTraceId,
  bonusAbilityTraceId,
  statBonusTraceId,
} from "@/domain/account/traces";
import {
  accountStatToDecimal,
  CATALOG_RELIC_SLOT,
  DMG_BOOST_STAT_BY_COMBAT_TYPE,
  decimalToAccountStat,
  RELIC_SLOT_BY_CATALOG_SLOT,
} from "@/domain/stats";
import {
  loadCharacters,
  loadPropertyTables,
} from "@/providers/reference/catalog";

describe("shared HSR domain vocabulary", () => {
  it("round-trips Relic slots and account stat units", () => {
    for (const [slot, catalogSlot] of Object.entries(CATALOG_RELIC_SLOT)) {
      expect(RELIC_SLOT_BY_CATALOG_SLOT[catalogSlot]).toBe(slot);
    }
    expect(accountStatToDecimal(6.48, "ratio")).toBeCloseTo(0.0648, 10);
    expect(decimalToAccountStat(0.0648, "ratio")).toBeCloseTo(6.48, 10);
    expect(accountStatToDecimal(42.3, "flat")).toBe(42.3);
  });

  it("names catalog properties and Combat Types that exist", async () => {
    const [properties, characters] = await Promise.all([
      loadPropertyTables(),
      loadCharacters(),
    ]);
    for (const statId of Object.values(DMG_BOOST_STAT_BY_COMBAT_TYPE)) {
      expect(properties.propertyById.has(statId), statId).toBe(true);
    }
    for (const combatType of properties.combatTypes) {
      expect(Object.keys(DMG_BOOST_STAT_BY_COMBAT_TYPE)).toContain(
        combatType.id
      );
    }

    const seele = characters.byId.get("1102");
    const traceIds = new Set(seele?.traces.map((trace) => trace.id));
    expect(traceIds.has(abilityTraceId("1102", "basic"))).toBe(true);
    expect(traceIds.has(abilityTraceId("1102", "ultimate"))).toBe(true);
    expect(traceIds.has(bonusAbilityTraceId("1102", 3))).toBe(true);
    expect(statBonusTraceId("1102", 10)).toBe("1102210");
    expect(() => statBonusTraceId("1102", 11)).toThrow();
  });
});
