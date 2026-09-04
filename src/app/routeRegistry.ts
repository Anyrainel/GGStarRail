import { APP_PATHS, type AppPath } from "@/config/navigation";
import type { MessageKey } from "@/i18n/messages.en";

export interface RouteDefinition {
  id:
    | "home"
    | "characters"
    | "inventory"
    | "resources"
    | "builds"
    | "filters"
    | "triage"
    | "tier-characters"
    | "tier-light-cones"
    | "tier-relics"
    | "archive-characters"
    | "archive-light-cones"
    | "archive-relic-sets"
    | "archive-achievements"
    | "imports";
  path: AppPath;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
}

export const ROUTE_REGISTRY: readonly RouteDefinition[] = [
  {
    id: "home",
    path: APP_PATHS.home,
    titleKey: "route.home.title",
    descriptionKey: "route.home.description",
  },
  {
    id: "characters",
    path: APP_PATHS.characters,
    titleKey: "route.characters.title",
    descriptionKey: "route.characters.description",
  },
  {
    id: "inventory",
    path: APP_PATHS.inventory,
    titleKey: "route.inventory.title",
    descriptionKey: "route.inventory.description",
  },
  {
    id: "resources",
    path: APP_PATHS.resources,
    titleKey: "route.resources.title",
    descriptionKey: "route.resources.description",
  },
  {
    id: "triage",
    path: APP_PATHS.triage,
    titleKey: "route.triage.title",
    descriptionKey: "route.triage.description",
  },
  {
    id: "builds",
    path: APP_PATHS.builds,
    titleKey: "route.builds.title",
    descriptionKey: "route.builds.description",
  },
  {
    id: "filters",
    path: APP_PATHS.filters,
    titleKey: "route.filters.title",
    descriptionKey: "route.filters.description",
  },
  {
    id: "tier-characters",
    path: APP_PATHS.tierCharacters,
    titleKey: "route.tierCharacters.title",
    descriptionKey: "route.tierCharacters.description",
  },
  {
    id: "tier-light-cones",
    path: APP_PATHS.tierLightCones,
    titleKey: "route.tierLightCones.title",
    descriptionKey: "route.tierLightCones.description",
  },
  {
    id: "tier-relics",
    path: APP_PATHS.tierRelics,
    titleKey: "route.tierRelics.title",
    descriptionKey: "route.tierRelics.description",
  },
  {
    id: "archive-characters",
    path: APP_PATHS.archiveCharacters,
    titleKey: "route.archiveCharacters.title",
    descriptionKey: "route.archiveCharacters.description",
  },
  {
    id: "archive-light-cones",
    path: APP_PATHS.archiveLightCones,
    titleKey: "route.archiveLightCones.title",
    descriptionKey: "route.archiveLightCones.description",
  },
  {
    id: "archive-relic-sets",
    path: APP_PATHS.archiveRelicSets,
    titleKey: "route.archiveRelicSets.title",
    descriptionKey: "route.archiveRelicSets.description",
  },
  {
    id: "archive-achievements",
    path: APP_PATHS.archiveAchievements,
    titleKey: "route.archiveAchievements.title",
    descriptionKey: "route.archiveAchievements.description",
  },
  {
    id: "imports",
    path: APP_PATHS.imports,
    titleKey: "route.imports.title",
    descriptionKey: "route.imports.description",
  },
];

export function routeDefinition(pathname: string): RouteDefinition | undefined {
  return ROUTE_REGISTRY.find((route) => route.path === pathname);
}
