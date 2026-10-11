import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  APP_PATHS,
  type AppPath,
  NAVIGATION_SECTIONS,
} from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";

const INDEX_COPY: Partial<
  Record<AppPath, { title: MessageKey; description: MessageKey }>
> = {
  [APP_PATHS.characters]: {
    title: "home.index.characters.title",
    description: "home.index.characters.description",
  },
  [APP_PATHS.inventory]: {
    title: "home.index.inventory.title",
    description: "home.index.inventory.description",
  },
  [APP_PATHS.resources]: {
    title: "home.index.resources.title",
    description: "home.index.resources.description",
  },
  [APP_PATHS.triage]: {
    title: "home.index.triage.title",
    description: "home.index.triage.description",
  },
  [APP_PATHS.builds]: {
    title: "home.index.builds.title",
    description: "home.index.builds.description",
  },
  [APP_PATHS.filters]: {
    title: "home.index.filters.title",
    description: "home.index.filters.description",
  },
  [APP_PATHS.tierCharacters]: {
    title: "home.index.tierCharacters.title",
    description: "home.index.tierCharacters.description",
  },
  [APP_PATHS.tierLightCones]: {
    title: "home.index.tierLightCones.title",
    description: "home.index.tierLightCones.description",
  },
  [APP_PATHS.tierRelics]: {
    title: "home.index.tierRelics.title",
    description: "home.index.tierRelics.description",
  },
  [APP_PATHS.archiveCharacters]: {
    title: "home.index.archiveCharacters.title",
    description: "home.index.archiveCharacters.description",
  },
  [APP_PATHS.archiveLightCones]: {
    title: "home.index.archiveLightCones.title",
    description: "home.index.archiveLightCones.description",
  },
  [APP_PATHS.archiveRelicSets]: {
    title: "home.index.archiveRelicSets.title",
    description: "home.index.archiveRelicSets.description",
  },
  [APP_PATHS.archiveAchievements]: {
    title: "home.index.archiveAchievements.title",
    description: "home.index.archiveAchievements.description",
  },
  [APP_PATHS.archiveCurrencyWar]: {
    title: "home.index.archiveCurrencyWar.title",
    description: "home.index.archiveCurrencyWar.description",
  },
};

/** Keep the home index and app navigation on the same set of real routes. */
export function FeatureMatrix() {
  const { t } = useI18n();
  return (
    <section className="w-full pt-5 md:pt-8" aria-labelledby="home-tools-title">
      <div className="mb-5 flex flex-col gap-2 text-center">
        <h2 id="home-tools-title" className="text-xl font-bold md:text-2xl">
          {t("home.tools.title")}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {NAVIGATION_SECTIONS.map((group) => (
          <div
            key={group.path}
            className="min-w-0 rounded-lg border border-border bg-card/30 p-3"
          >
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/70">
              {t(group.labelKey)}
            </h3>
            <ul className="space-y-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                const copy = INDEX_COPY[item.path];
                if (!copy)
                  throw new Error(`Missing home index copy: ${item.path}`);
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className="group/link block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground group-hover/link:text-primary">
                        <Icon
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {t(copy.title)}
                        <ArrowRight
                          className="size-3.5 shrink-0 transition-transform group-hover/link:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {t(copy.description)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
