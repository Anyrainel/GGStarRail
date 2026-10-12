import { useMemo, useState } from "react";
import { SidebarPanel, SidebarSection } from "@/components/layout/SidebarPanel";
import {
  SelectField,
  type SelectOption,
  ToggleField,
} from "@/components/shared/FieldControls";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { SearchInput } from "@/components/shared/SearchInput";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

export interface FilterCharacterOption {
  id: string;
  name: string;
  /** Lower-cased name plus aliases for search. */
  searchText: string;
  iconPath: string;
  rarity: number;
  buildCount: number;
}

interface RelicFilterSidebarProps {
  characters: readonly FilterCharacterOption[];
  selectedCharacterId: string | null;
  onSelectCharacter: (id: string) => void;
  cavernOptions: readonly SelectOption[];
  cavernValue: string;
  onCavernChange: (id: string) => void;
  planarOptions: readonly SelectOption[];
  planarValue: string;
  onPlanarChange: (id: string) => void;
  matchesOnly: boolean;
  onMatchesOnlyChange: (value: boolean) => void;
  /** Candidates need account Relics; without them the toggle has no effect. */
  matchesOnlyDisabled: boolean;
  /** False when the Character has no build of that kind. */
  hasCavern: boolean;
  hasPlanar: boolean;
}

/** Relic Filters sidebar: pick a Character with builds, then its Cavern and Planar builds. */
export function RelicFilterSidebar({
  characters,
  selectedCharacterId,
  onSelectCharacter,
  cavernOptions,
  cavernValue,
  onCavernChange,
  planarOptions,
  planarValue,
  onPlanarChange,
  matchesOnly,
  onMatchesOnlyChange,
  matchesOnlyDisabled,
  hasCavern,
  hasPlanar,
}: RelicFilterSidebarProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return characters;
    return characters.filter((character) =>
      character.searchText.includes(needle)
    );
  }, [characters, query]);

  return (
    <SidebarPanel label={t("common.filters")}>
      <SearchInput
        variant="sidebar"
        label={t("build.searchPlaceholder")}
        placeholder={t("build.searchPlaceholder")}
        value={query}
        onValueChange={setQuery}
      />

      <SidebarSection title={t("filters.character")}>
        <fieldset
          aria-label={t("filters.character")}
          className="-mx-1 max-h-[min(26rem,50dvh)] min-w-0 space-y-0.5 overflow-y-auto overscroll-contain p-1"
          data-filter-character-list
        >
          {visible.map((character) => {
            const selected = character.id === selectedCharacterId;
            return (
              <button
                key={character.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectCharacter(character.id)}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "bg-primary/15 ring-1 ring-primary/30"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
                data-filter-character={character.id}
              >
                <ItemIcon
                  kind="character"
                  id={character.id}
                  sourcePath={character.iconPath}
                  rarity={character.rarity}
                  size="sm"
                  alt=""
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {character.name}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {character.buildCount}
                </span>
              </button>
            );
          })}
          {visible.length === 0 && (
            <p
              role="status"
              className="px-2 py-3 text-center text-sm text-muted-foreground"
            >
              {t("empty.filtered")}
            </p>
          )}
        </fieldset>
      </SidebarSection>

      <SidebarSection title={t("filters.build")}>
        <div className="space-y-3">
          <SelectField
            label={t("build.cavernCards")}
            value={cavernValue}
            options={cavernOptions}
            disabled={!hasCavern}
            onChange={onCavernChange}
          />
          <SelectField
            label={t("build.planarCards")}
            value={planarValue}
            options={planarOptions}
            disabled={!hasPlanar}
            onChange={onPlanarChange}
          />
        </div>
        <div className="-mx-2">
          <ToggleField
            label={t("filters.matchesOnly")}
            checked={matchesOnly}
            disabled={matchesOnlyDisabled}
            onChange={onMatchesOnlyChange}
          />
        </div>
      </SidebarSection>
    </SidebarPanel>
  );
}
