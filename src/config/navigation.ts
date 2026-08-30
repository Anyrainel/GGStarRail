import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Boxes,
  CircleGauge,
  DatabaseZap,
  Filter,
  Gem,
  Library,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  UsersRound,
  WandSparkles,
} from "lucide-react";
import type { MessageKey } from "@/i18n/messages.en";

export const APP_PATHS = {
  home: "/",
  characters: "/account-data/characters",
  inventory: "/account-data/inventory",
  lightCones: "/account-data/light-cones",
  relics: "/account-data/relics",
  planarOrnaments: "/account-data/planar-ornaments",
  builds: "/builds/configure",
  scoring: "/builds/scoring",
  filters: "/builds/filters",
  triage: "/builds/triage",
  archiveCharacters: "/archive/characters",
  archiveLightCones: "/archive/light-cones",
  archiveRelicSets: "/archive/relic-sets",
  imports: "/data-sources",
} as const;

export type AppPath = (typeof APP_PATHS)[keyof typeof APP_PATHS];

export interface NavigationItem {
  path: AppPath;
  labelKey: MessageKey;
  icon: LucideIcon;
}

export interface NavigationGroup {
  labelKey: MessageKey;
  items: readonly NavigationItem[];
}

export const NAV_GROUPS: readonly NavigationGroup[] = [
  {
    labelKey: "nav.account",
    items: [
      {
        path: APP_PATHS.characters,
        labelKey: "nav.characters",
        icon: UsersRound,
      },
      {
        path: APP_PATHS.inventory,
        labelKey: "nav.inventory",
        icon: Boxes,
      },
    ],
  },
  {
    labelKey: "nav.equipment",
    items: [
      {
        path: APP_PATHS.lightCones,
        labelKey: "nav.lightCones",
        icon: WandSparkles,
      },
      { path: APP_PATHS.relics, labelKey: "nav.relics", icon: Gem },
      {
        path: APP_PATHS.planarOrnaments,
        labelKey: "nav.planarOrnaments",
        icon: Sparkles,
      },
    ],
  },
  {
    labelKey: "nav.planning",
    items: [
      {
        path: APP_PATHS.builds,
        labelKey: "nav.builds",
        icon: SlidersHorizontal,
      },
      { path: APP_PATHS.scoring, labelKey: "nav.scoring", icon: CircleGauge },
      { path: APP_PATHS.filters, labelKey: "nav.filters", icon: Filter },
      { path: APP_PATHS.triage, labelKey: "nav.triage", icon: DatabaseZap },
    ],
  },
  {
    labelKey: "nav.archive",
    items: [
      {
        path: APP_PATHS.archiveCharacters,
        labelKey: "nav.archiveCharacters",
        icon: UserRound,
      },
      {
        path: APP_PATHS.archiveLightCones,
        labelKey: "nav.archiveLightCones",
        icon: Library,
      },
      {
        path: APP_PATHS.archiveRelicSets,
        labelKey: "nav.archiveRelicSets",
        icon: Archive,
      },
    ],
  },
];
