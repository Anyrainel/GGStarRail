import { useMemo } from "react";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import type { BuildReferences } from "@/lib/buildReferences";
import {
  catalogPickerItems,
  rarityPickerFilter,
} from "@/lib/catalogPickerItems";
import type { CharacterDefinition } from "@/providers/gilore/types";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const EMPTY_CHOICES: string[] = [];

export function CharacterLightCones({
  character,
  references,
}: {
  character: CharacterDefinition;
  references: BuildReferences;
}) {
  const { locale, t } = useI18n();
  const narrow = useMediaQuery("(max-width: 767px)");
  const ids = useWorkspaceStore(
    (state) => state.characterLightConeIds[character.id] ?? EMPTY_CHOICES
  );
  const setChoices = useWorkspaceStore((state) => state.setCharacterLightCones);
  const items = useMemo(
    () =>
      catalogPickerItems(
        "light-cone",
        references,
        locale,
        t("terms.trailblazer")
      ).filter((item) => item.tags?.includes(character.path_id)),
    [character.path_id, references, locale, t]
  );
  const filters = useMemo(
    () => [rarityPickerFilter(items, t("filter.rarity"))],
    [items, t]
  );
  return (
    <fieldset
      aria-label={t("build.lightCones")}
      className="flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto py-1"
      data-character-light-cones
    >
      {ids.map((id, index) => (
        <ItemPicker
          key={id}
          kind="light-cone"
          label={t("build.lightConeSlot", { index: index + 1 })}
          triggerSize={narrow ? "sm" : "md"}
          value={id}
          items={items.filter(
            (item) => item.id === id || !ids.includes(item.id)
          )}
          filters={filters}
          onChange={(next) =>
            setChoices(
              character.id,
              ids.map((current, i) => (i === index ? next : current))
            )
          }
          onClear={() =>
            setChoices(
              character.id,
              ids.filter((_, i) => i !== index)
            )
          }
        />
      ))}
      {ids.length < 5 && (
        <ItemPicker
          kind="light-cone"
          label={t("build.addLightCone")}
          triggerSize={narrow ? "sm" : "md"}
          compact={ids.length > 0}
          value={null}
          items={items.filter((item) => !ids.includes(item.id))}
          filters={filters}
          onChange={(id) => setChoices(character.id, [...ids, id])}
        />
      )}
    </fieldset>
  );
}
