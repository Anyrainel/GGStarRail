import type { LucideIcon } from "lucide-react";
import { Crosshair, Medal, TrendingUp } from "lucide-react";
import { APP_PATHS, type AppPath } from "@/config/navigation";
import type { TeamPlan } from "@/domain/team/schemas";
import type { MessageKey } from "@/i18n/messages.en";
import type { PickerItem } from "@/services/catalog/pickerTypes";

/** The three Team DMG tabs; each shows the team grid or one team's detail. */
export type TeamDmgTab = "optimizer" | "investment" | "choice";

/** Contract for each tab's team detail. */
export interface TeamDetailProps {
  team: TeamPlan;
  onBack: () => void;
}

export interface TeamDmgTabMeta {
  readonly path: AppPath;
  readonly labelKey: MessageKey;
  readonly titleKey: MessageKey;
  readonly aspectKey: MessageKey;
  readonly icon: LucideIcon;
}

export const TEAM_DMG_TABS: Readonly<Record<TeamDmgTab, TeamDmgTabMeta>> = {
  optimizer: {
    path: APP_PATHS.teamDamage,
    labelKey: "nav.teamDamage",
    titleKey: "route.teamDamage.title",
    aspectKey: "teamDmg.aspect.optimizer",
    icon: Crosshair,
  },
  investment: {
    path: APP_PATHS.teamInvestment,
    labelKey: "nav.teamInvestment",
    titleKey: "route.teamInvestment.title",
    aspectKey: "teamDmg.aspect.investment",
    icon: TrendingUp,
  },
  choice: {
    path: APP_PATHS.teamChoice,
    labelKey: "nav.teamChoice",
    titleKey: "route.teamChoice.title",
    aspectKey: "teamDmg.aspect.choice",
    icon: Medal,
  },
};

export const TEAM_DMG_TAB_ORDER: readonly TeamDmgTab[] = [
  "optimizer",
  "investment",
  "choice",
];

/** Catalog picker items for Characters, Light Cones and Relic sets. */
export interface MemberPickerItems {
  readonly characters: readonly PickerItem[];
  readonly lightCones: readonly PickerItem[];
  /** Cavern Relic sets only. */
  readonly cavernSets: readonly PickerItem[];
  /** Planar Ornament sets only. */
  readonly planarSets: readonly PickerItem[];
}

export interface MemberItemLookup {
  readonly characters: ReadonlyMap<string, PickerItem>;
  readonly lightCones: ReadonlyMap<string, PickerItem>;
  readonly relicSets: ReadonlyMap<string, PickerItem>;
}
