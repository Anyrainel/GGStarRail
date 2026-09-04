import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Boxes,
  Crown,
  Database,
  DatabaseZap,
  Filter,
  Gem,
  Library,
  Lightbulb,
  SlidersHorizontal,
  Trophy,
  UserRound,
  UsersRound,
  WandSparkles,
} from "lucide-react";
import type { MessageKey } from "@/i18n/messages.en";

export const APP_PATHS = {
  home: "/",
  characters: "/account-data/characters",
  inventory: "/account-data/inventory",
  resources: "/account-data/resources",
  triage: "/account-data/triage",
  builds: "/builds/configure",
  filters: "/builds/filters",
  tierCharacters: "/tier-list/characters",
  tierLightCones: "/tier-list/light-cones",
  tierRelics: "/tier-list/relics",
  archiveCharacters: "/archive/characters",
  archiveLightCones: "/archive/light-cones",
  archiveRelicSets: "/archive/relic-sets",
  archiveAchievements: "/archive/achievements",
  imports: "/data-sources",
} as const;

export type AppPath = (typeof APP_PATHS)[keyof typeof APP_PATHS];

export interface NavigationItem {
  path: AppPath;
  labelKey: MessageKey;
  icon: LucideIcon;
}

export interface NavigationSection {
  path: string;
  labelKey: MessageKey;
  items: readonly NavigationItem[];
}

export const NAVIGATION_SECTIONS: readonly NavigationSection[] = [
  {
    path: "/account-data",
    labelKey: "nav.accountData",
    items: [
      {
        path: APP_PATHS.characters,
        labelKey: "nav.characters",
        icon: UsersRound,
      },
      { path: APP_PATHS.inventory, labelKey: "nav.inventory", icon: Boxes },
      {
        path: APP_PATHS.resources,
        labelKey: "nav.resources",
        icon: Lightbulb,
      },
      { path: APP_PATHS.triage, labelKey: "nav.triage", icon: DatabaseZap },
    ],
  },
  {
    path: "/builds",
    labelKey: "nav.planning",
    items: [
      {
        path: APP_PATHS.builds,
        labelKey: "nav.builds",
        icon: SlidersHorizontal,
      },
      { path: APP_PATHS.filters, labelKey: "nav.filters", icon: Filter },
    ],
  },
  {
    path: "/tier-list",
    labelKey: "nav.tierList",
    items: [
      {
        path: APP_PATHS.tierCharacters,
        labelKey: "nav.tierCharacters",
        icon: Crown,
      },
      {
        path: APP_PATHS.tierLightCones,
        labelKey: "nav.tierLightCones",
        icon: WandSparkles,
      },
      {
        path: APP_PATHS.tierRelics,
        labelKey: "nav.tierRelics",
        icon: Gem,
      },
    ],
  },
  {
    path: "/archive",
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
      {
        path: APP_PATHS.archiveAchievements,
        labelKey: "nav.archiveAchievements",
        icon: Trophy,
      },
    ],
  },
];

export const DATA_SOURCES_NAV: NavigationItem = {
  path: APP_PATHS.imports,
  labelKey: "nav.imports",
  icon: Database,
};

export function navigationSection(pathname: string) {
  return NAVIGATION_SECTIONS.find((section) =>
    section.items.some((item) => item.path === pathname)
  );
}
