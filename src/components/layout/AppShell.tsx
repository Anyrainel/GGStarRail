import { Database, Languages, Orbit } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { APP_PATHS, NAV_GROUPS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

function Brand() {
  const { t } = useI18n();
  return (
    <NavLink to={APP_PATHS.home} className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-glow">
        <Orbit className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-wide">
          {t("app.name")}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {t("app.foundation")}
        </span>
      </span>
    </NavLink>
  );
}

function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <fieldset className="flex items-center gap-1 rounded-lg border border-border bg-background/60 p-1">
      <legend className="sr-only">{t("app.locale")}</legend>
      {!compact && <Languages className="mx-1 h-4 w-4 text-muted-foreground" />}
      <Button
        size="sm"
        variant={locale === "en" ? "secondary" : "ghost"}
        onClick={() => setLocale("en")}
      >
        EN
      </Button>
      <Button
        size="sm"
        variant={locale === "zh-CN" ? "secondary" : "ghost"}
        onClick={() => setLocale("zh-CN")}
      >
        中文
      </Button>
    </fieldset>
  );
}

function DesktopNavigation() {
  const { t } = useI18n();
  return (
    <nav className="space-y-5" aria-label="Primary">
      {NAV_GROUPS.map((group) => (
        <section key={group.labelKey} className="space-y-1.5">
          <h2 className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t(group.labelKey)}
          </h2>
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "border-primary/35 bg-primary/12 text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-secondary/70 hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
        </section>
      ))}
      <NavLink
        to={APP_PATHS.imports}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
            isActive
              ? "border-primary/35 bg-primary/12 text-foreground"
              : "border-border/70 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
          )
        }
      >
        <Database className="h-4 w-4" aria-hidden="true" />
        {t("nav.imports")}
      </NavLink>
    </nav>
  );
}

function MobileNavigation() {
  const { t } = useI18n();
  const location = useLocation();
  const navigationRef = useRef<HTMLElement>(null);
  const items = NAV_GROUPS.flatMap((group) => group.items);

  useEffect(() => {
    if (!location.pathname) return;
    const activeLink = navigationRef.current?.querySelector<HTMLElement>(
      '[aria-current="page"]'
    );
    activeLink?.scrollIntoView?.({
      behavior: "auto",
      block: "nearest",
      inline: "center",
    });
  }, [location.pathname]);

  return (
    <nav
      ref={navigationRef}
      className="scrollbar-none flex gap-2 overflow-x-auto border-b border-border px-3 py-2 lg:hidden"
      aria-label="Primary"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium",
                isActive
                  ? "border-primary/40 bg-primary/15 text-foreground"
                  : "border-border bg-card/70 text-muted-foreground"
              )
            }
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {t(item.labelKey)}
          </NavLink>
        );
      })}
      <NavLink
        to={APP_PATHS.imports}
        className={({ isActive }) =>
          cn(
            "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium",
            isActive
              ? "border-primary/40 bg-primary/15 text-foreground"
              : "border-border bg-card/70 text-muted-foreground"
          )
        }
      >
        <Database className="h-3.5 w-3.5" aria-hidden="true" />
        {t("nav.imports")}
      </NavLink>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/55 lg:flex">
        <div className="border-b border-border p-5">
          <Brand />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <DesktopNavigation />
        </div>
        <div className="border-t border-border p-4">
          <LocaleSwitcher />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card/65 px-3 py-3 backdrop-blur lg:hidden">
          <Brand />
          <LocaleSwitcher compact />
        </header>
        <MobileNavigation />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
