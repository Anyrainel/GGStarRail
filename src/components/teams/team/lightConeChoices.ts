import { useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { PickerFilter, PickerItem } from "@/services/catalog/pickerTypes";
import { localizedName } from "@/services/catalog/presentation";
import { useTeamDmgData } from "./TeamDmgData";

export interface LightConeChoices {
  readonly items: readonly PickerItem[];
  readonly filters: readonly PickerFilter[];
}

/**
 * Light Cone picker choices for a Character's Path: every Light Cone, that
 * Path first, with a chip that narrows to it. Any Character can equip any
 * Light Cone; only the passive needs a matching Path (the engine then applies
 * just the base stats), and each tile shows its Path icon.
 */
export function useLightConeChoices(): (
  pathId: string | undefined
) => LightConeChoices {
  const { locale, t } = useI18n();
  const { items, references } = useTeamDmgData();
  return useCallback(
    (pathId) => {
      if (!pathId) return { items: items.lightCones, filters: [] };
      const onPath = (item: PickerItem) => item.tags?.includes(pathId) ?? false;
      const path = references.properties.pathById.get(pathId);
      return {
        items: [
          ...items.lightCones.filter(onPath),
          ...items.lightCones.filter((item) => !onPath(item)),
        ],
        filters: [
          {
            id: "path",
            label: t("filter.path"),
            options: [
              { id: pathId, label: localizedName(path?.name, locale, pathId) },
            ],
          },
        ],
      };
    },
    [items.lightCones, references, locale, t]
  );
}
