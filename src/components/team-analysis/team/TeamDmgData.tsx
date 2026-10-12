import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AccountSnapshot } from "@/domain/account/schemas";
import type { TeamPlan } from "@/domain/team/schemas";
import { useI18n } from "@/i18n/I18nContext";
import type { BuildReferences } from "@/services/catalog/buildReferences";
import { catalogPickerItems } from "@/services/catalog/pickerItems";
import type { WorkspaceSources } from "@/services/combat/jobs";
import {
  type CombatPresets,
  loadCombatPresets,
  NO_COMBAT_PRESETS,
  previewTeam,
  type TeamPreview,
} from "@/services/combat/teamPreview";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import type { MemberItemLookup, MemberPickerItems } from "./types";

/** Catalog and workspace data every Team DMG view reads. */
export interface TeamDmgData {
  readonly references: BuildReferences;
  readonly items: MemberPickerItems;
  readonly lookup: MemberItemLookup;
  readonly account: AccountSnapshot | null;
  readonly sources: WorkspaceSources;
  readonly presets: CombatPresets;
  /** Displayed gear before a simulation exists (memoized per team object). */
  readonly previewOf: (team: TeamPlan) => TeamPreview;
}

const TeamDmgDataContext = createContext<TeamDmgData | null>(null);

function byId<T extends { id: string }>(
  list: readonly T[]
): ReadonlyMap<string, T> {
  return new Map(list.map((item) => [item.id, item]));
}

/** Loads the recommendation presets once; empty until they arrive. */
function useCombatPresets(): CombatPresets {
  const [presets, setPresets] = useState<CombatPresets>(NO_COMBAT_PRESETS);
  useEffect(() => {
    let active = true;
    loadCombatPresets().then(
      (loaded) => {
        if (active) setPresets(loaded);
      },
      () => undefined
    );
    return () => {
      active = false;
    };
  }, []);
  return presets;
}

export function TeamDmgDataProvider({
  references,
  children,
}: {
  references: BuildReferences;
  children: ReactNode;
}) {
  const { locale, t } = useI18n();
  const account = useWorkspaceStore((state) => state.account);
  const builds = useWorkspaceStore((state) => state.builds);
  const characterLightConeIds = useWorkspaceStore(
    (state) => state.characterLightConeIds
  );
  const presets = useCombatPresets();
  const sources = useMemo<WorkspaceSources>(
    () => ({ account, builds, characterLightConeIds }),
    [account, builds, characterLightConeIds]
  );
  const items = useMemo<MemberPickerItems>(() => {
    const trailblazer = t("terms.trailblazer");
    const relicSets = catalogPickerItems(
      "relic-set",
      references,
      locale,
      trailblazer
    );
    return {
      characters: catalogPickerItems(
        "character",
        references,
        locale,
        trailblazer
      ),
      lightCones: catalogPickerItems(
        "light-cone",
        references,
        locale,
        trailblazer
      ),
      cavernSets: relicSets.filter((item) =>
        item.tags?.includes("cavern_relic")
      ),
      planarSets: relicSets.filter((item) =>
        item.tags?.includes("planar_ornament")
      ),
    };
  }, [references, locale, t]);
  const lookup = useMemo<MemberItemLookup>(
    () => ({
      characters: byId(items.characters),
      lightCones: byId(items.lightCones),
      relicSets: byId([...items.cavernSets, ...items.planarSets]),
    }),
    [items]
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new cache per input set
  const previews = useMemo(
    () => new WeakMap<TeamPlan, TeamPreview>(),
    [sources, presets]
  );
  const previewOf = useCallback(
    (team: TeamPlan) => {
      let preview = previews.get(team);
      if (!preview) {
        preview = previewTeam(team, sources, presets);
        previews.set(team, preview);
      }
      return preview;
    },
    [previews, sources, presets]
  );
  const value = useMemo<TeamDmgData>(
    () => ({
      references,
      items,
      lookup,
      account,
      sources,
      presets,
      previewOf,
    }),
    [references, items, lookup, account, sources, presets, previewOf]
  );
  return (
    <TeamDmgDataContext.Provider value={value}>
      {children}
    </TeamDmgDataContext.Provider>
  );
}

/** Team DMG data; only valid inside the Team DMG page. */
export function useTeamDmgData(): TeamDmgData {
  const value = useContext(TeamDmgDataContext);
  if (!value) throw new Error("useTeamDmgData outside TeamDmgDataProvider");
  return value;
}
