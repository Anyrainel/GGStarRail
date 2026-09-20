import { Link } from "react-router-dom";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { characterCatalogName } from "@/lib/catalogPresentation";
import { getLocalizedValue } from "@/providers/reference/catalog";
import type {
  CharacterDefinition,
  CurrencyWarBond,
  CurrencyWarEquipment,
} from "@/providers/reference/types";

export function CurrencyWarEquipmentRules({
  equipment,
  characters,
  bonds,
}: {
  equipment: CurrencyWarEquipment;
  characters: readonly CharacterDefinition[];
  bonds: readonly CurrencyWarBond[];
}) {
  const { locale, t } = useI18n();
  const roleIds = new Set(equipment.dress_rule_parameters.map(String));
  const eligibleCharacters =
    equipment.dress_rule === "DressRuleRoleOnly"
      ? characters.filter(
          (character) =>
            roleIds.has(character.id) ||
            character.currency_war.some((role) => roleIds.has(role.id))
        )
      : [];
  const bondIds =
    equipment.dress_rule === "DressRuleTraitOnly" ||
    equipment.dress_rule === "DressRuleUniqueAndExclusiveTrait"
      ? equipment.dress_rule_parameters
      : equipment.function === "AddTraitLayer"
        ? equipment.function_parameters
        : [];
  const linkedBonds = bondIds.flatMap((id) => {
    const bond = bonds.find((entry) => entry.id === String(id));
    return bond ? [bond] : [];
  });
  const unique = equipment.dress_rule === "DressRuleUnique";
  const uniqueBond =
    equipment.dress_rule === "DressRuleUniqueAndExclusiveTrait";
  const emptySlots = equipment.dress_rule === "DressRuleAllSlotEmpty";
  const capacity =
    equipment.function === "AvatarMaxNumberAdd"
      ? equipment.function_parameters[0]
      : undefined;
  if (
    !unique &&
    !uniqueBond &&
    !emptySlots &&
    !eligibleCharacters.length &&
    !linkedBonds.length &&
    capacity === undefined
  )
    return null;
  const linkClass =
    "inline-flex rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover:border-primary/60";
  return (
    <section
      className="space-y-2 rounded-xl border border-border bg-secondary/35 p-3 text-sm"
      aria-label={t("archive.currencyWar.equipmentRules")}
    >
      {unique && <p>{t("archive.currencyWar.uniqueEquipment")}</p>}
      {uniqueBond && <p>{t("archive.currencyWar.uniqueBondEmblem")}</p>}
      {emptySlots && <p>{t("archive.currencyWar.emptyEquipmentSlots")}</p>}
      {eligibleCharacters.length > 0 && (
        <div className="space-y-2">
          <p>{t("archive.currencyWar.onlyCharacters")}</p>
          <div className="flex flex-wrap gap-2">
            {eligibleCharacters.map((character) => (
              <Link
                key={character.id}
                className={linkClass}
                to={`${APP_PATHS.archiveCharacters}?id=${character.id}`}
              >
                {characterCatalogName(
                  character,
                  locale,
                  t("terms.trailblazer")
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
      {linkedBonds.length > 0 && (
        <div className="space-y-2">
          <p>
            {equipment.dress_rule === "DressRuleTraitOnly"
              ? t("archive.currencyWar.onlyBondMembers")
              : t("archive.currencyWar.grantedBond")}
          </p>
          <div className="flex flex-wrap gap-2">
            {linkedBonds.map((bond) => (
              <Link
                key={bond.id}
                className={linkClass}
                to={`${APP_PATHS.archiveCurrencyWar}?tab=bonds&id=${bond.id}`}
              >
                {getLocalizedValue(bond.name, locale)}
              </Link>
            ))}
          </div>
        </div>
      )}
      {capacity !== undefined && (
        <p>{t("archive.currencyWar.squadCapacity", { value: capacity })}</p>
      )}
    </section>
  );
}
