import { Plus } from "lucide-react";
import { useMemo } from "react";
import type { ItemIconSize } from "@/components/shared/ItemIcon";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useI18n } from "@/i18n/I18nContext";
import type { CharacterDefinition } from "@/providers/reference/types";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import {
  catalogPickerItems,
  rarityPickerFilter,
} from "@/services/catalog/pickerItems";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

const EMPTY_CHOICES: string[] = [];

/** Visible Light Cone choices per width: phone 1, tablet 3, desktop 5. */
function lightConeCap(mobile: boolean, desktop: boolean): number {
  if (mobile) return 1;
  return desktop ? 5 : 3;
}

export function CharacterLightCones({
  character,
  references,
  iconSize = "lg",
}: {
  character: CharacterDefinition;
  references: BuildReferences;
  /** The card's icon size: lg, or md on very narrow screens. */
  iconSize?: ItemIconSize;
}) {
  const { locale, t } = useI18n();
  const mobile = useMediaQuery("(max-width: 767px)");
  const desktop = useMediaQuery("(min-width: 1024px)");
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
  const cap = lightConeCap(mobile, desktop);
  const visible = ids.slice(0, cap);
  const remaining = items.filter((item) => !ids.includes(item.id));
  // An empty slot stands in until the first choice; later additions use a
  // compact plus while the width still has room.
  const showPlaceholder = ids.length < 1;
  const showCompactAdd =
    !mobile && ids.length > 0 && ids.length < cap && ids.length < 5;
  const addToEnd = (id: string) => setChoices(character.id, [...ids, id]);

  return (
    <fieldset
      aria-label={t("build.lightCones")}
      className="flex shrink-0 items-center gap-2"
      data-character-light-cones
    >
      {visible.map((id, index) => (
        <ItemPicker
          key={id}
          kind="light-cone"
          label={t("build.lightConeSlot", { index: index + 1 })}
          triggerSize={iconSize}
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
      {showPlaceholder && (
        <ItemPicker
          kind="light-cone"
          label={t("build.addLightCone")}
          triggerSize={iconSize}
          value={null}
          items={remaining}
          filters={filters}
          onChange={addToEnd}
        />
      )}
      {showCompactAdd && (
        <ItemPicker
          kind="light-cone"
          label={t("build.addLightCone")}
          value={null}
          items={remaining}
          filters={filters}
          onChange={addToEnd}
          renderTrigger={() => (
            <span className="flex h-7 w-7 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        />
      )}
    </fieldset>
  );
}
