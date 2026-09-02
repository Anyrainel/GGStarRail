import { APP_PATHS, type AppPath } from "@/config/navigation";
import type { MessageKey } from "@/i18n/messages.en";

export interface RouteDefinition {
  id:
    | "home"
    | "characters"
    | "inventory"
    | "light-cones"
    | "relics"
    | "planar-ornaments"
    | "builds"
    | "scoring"
    | "filters"
    | "triage"
    | "archive-characters"
    | "archive-light-cones"
    | "archive-relic-sets"
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
    id: "light-cones",
    path: APP_PATHS.lightCones,
    titleKey: "route.lightCones.title",
    descriptionKey: "route.lightCones.description",
  },
  {
    id: "relics",
    path: APP_PATHS.relics,
    titleKey: "route.relics.title",
    descriptionKey: "route.relics.description",
  },
  {
    id: "planar-ornaments",
    path: APP_PATHS.planarOrnaments,
    titleKey: "route.planar.title",
    descriptionKey: "route.planar.description",
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
    id: "scoring",
    path: APP_PATHS.scoring,
    titleKey: "route.scoring.title",
    descriptionKey: "route.scoring.description",
  },
  {
    id: "filters",
    path: APP_PATHS.filters,
    titleKey: "route.filters.title",
    descriptionKey: "route.filters.description",
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
    id: "imports",
    path: APP_PATHS.imports,
    titleKey: "route.imports.title",
    descriptionKey: "route.imports.description",
  },
];

export function routeDefinition(pathname: string): RouteDefinition | undefined {
  return ROUTE_REGISTRY.find((route) => route.path === pathname);
}
