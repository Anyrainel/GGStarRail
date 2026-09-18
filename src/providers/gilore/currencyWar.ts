import { loadGameMember } from "@/data/gameDataLoader";
import { loadCatalogAssetLookup } from "./assets";
import { HSR_REFERENCE_MANIFEST } from "./catalog";
import type {
  CurrencyWarBond,
  CurrencyWarEnvironment,
  CurrencyWarEquipment,
  CurrencyWarStrategy,
  MemberDocument,
} from "./types";

export interface CurrencyWarCatalog {
  equipment: readonly CurrencyWarEquipment[];
  environments: readonly CurrencyWarEnvironment[];
  strategies: readonly CurrencyWarStrategy[];
  bonds: readonly CurrencyWarBond[];
}

async function loadCurrencyWarMember<T>(member: string): Promise<readonly T[]> {
  const document = (await loadGameMember(member)) as MemberDocument<
    readonly T[],
    "1.3.0"
  >;
  if (
    document.schema_version !== "1.3.0" ||
    document.schema_version !== HSR_REFERENCE_MANIFEST.schema_version ||
    document.collection !== member ||
    !Array.isArray(document.value)
  ) {
    throw new Error(`Invalid Currency War catalog: ${member}`);
  }
  return document.value;
}

export async function loadCurrencyWarCatalog(): Promise<CurrencyWarCatalog> {
  const [equipment, environments, strategies, bonds] = await Promise.all([
    loadCurrencyWarMember<CurrencyWarEquipment>("currency_war_equipment"),
    loadCurrencyWarMember<CurrencyWarEnvironment>("currency_war_environments"),
    loadCurrencyWarMember<CurrencyWarStrategy>("currency_war_strategies"),
    loadCurrencyWarMember<CurrencyWarBond>("currency_war_bonds"),
    loadCatalogAssetLookup(),
  ]);
  return { equipment, environments, strategies, bonds };
}
