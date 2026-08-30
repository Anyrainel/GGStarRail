import { NavLink } from "react-router-dom";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { cn } from "@/lib/utils";

const tabs = [
  {
    path: APP_PATHS.archiveCharacters,
    labelKey: "nav.archiveCharacters" as MessageKey,
  },
  {
    path: APP_PATHS.archiveLightCones,
    labelKey: "nav.archiveLightCones" as MessageKey,
  },
  {
    path: APP_PATHS.archiveRelicSets,
    labelKey: "nav.archiveRelicSets" as MessageKey,
  },
] as const;

export function ArchiveTabs() {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("archive.tabs.label")}
      className="scrollbar-none flex gap-2 overflow-x-auto rounded-xl border border-border bg-card/55 p-2"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) =>
            cn(
              "shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary/40 bg-primary/15 text-foreground"
                : "border-border bg-background/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
            )
          }
        >
          {t(tab.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}
