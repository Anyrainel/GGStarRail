import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { routeDefinition } from "@/app/routeRegistry";
import { NAVIGATION_SECTIONS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";

/** Keep the home index and app navigation on the same set of real routes. */
export function FeatureMatrix() {
  const { t } = useI18n();
  return (
    <section className="w-full pt-5 md:pt-8" aria-labelledby="home-tools-title">
      <div className="mb-5 flex flex-col gap-2 text-center">
        <h2 id="home-tools-title" className="text-xl font-bold md:text-2xl">
          {t("home.tools.title")}
        </h2>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
          {t("home.tools.body")}
        </p>
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
                const route = routeDefinition(item.path);
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
                        {t(item.labelKey)}
                        <ArrowRight
                          className="size-3.5 shrink-0 transition-transform group-hover/link:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                      {route && (
                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                          {t(route.descriptionKey)}
                        </span>
                      )}
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
