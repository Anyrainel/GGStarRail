import {
  Check,
  ChevronDown,
  ExternalLink,
  Languages,
  Menu,
  MoreVertical,
  Palette,
  Sparkles,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AccountImportAction } from "@/components/account/AccountImportAction";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheck,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  APP_PATHS,
  DATA_SOURCES_NAV,
  NAVIGATION_SECTIONS,
  navigationSection,
} from "@/config/navigation";
import { THEME_IDS, useTheme } from "@/contexts/ThemeContext";
import type { ThemeId } from "@/contexts/themeTypes";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

const GENSHIN_SITE_URL =
  import.meta.env.VITE_GENSHIN_SITE_URL ?? "https://ggartifact.com";

function SiteSwitcher() {
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 min-w-0 gap-2 px-1.5 text-muted-foreground hover:bg-transparent hover:text-foreground sm:px-2"
          aria-label={t("site.switcher.label")}
        >
          <img src="/assets/ggstarrail/mark.svg" className="h-8 w-8" alt="" />
          <span className="hidden text-base font-semibold sm:inline">
            GG Artifact
          </span>
          <span className="rounded-md border border-primary/35 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
            {t("site.starRail.short")}
          </span>
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>{t("site.switcher.label")}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <a href={GENSHIN_SITE_URL}>
            <Sparkles className="h-7 w-7 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">GGArtifact</span>
              <span className="block text-xs text-muted-foreground">
                {t("site.genshin")}
              </span>
            </span>
            <ExternalLink
              className="text-muted-foreground"
              aria-hidden="true"
            />
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={APP_PATHS.home} aria-current="page">
            <img src="/assets/ggstarrail/mark.svg" className="h-7 w-7" alt="" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">GGStarRail</span>
              <span className="block text-xs text-muted-foreground">
                {t("site.starRail")}
              </span>
            </span>
            <Check className="text-primary" aria-hidden="true" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeAndLocaleMenu() {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();

  const themeLabel = (themeId: ThemeId) => {
    switch (themeId) {
      case "astral":
        return t("theme.astral");
      case "express":
        return t("theme.express");
      case "dreamscape":
        return t("theme.dreamscape");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t("common.more")}>
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Languages className="h-4 w-4" aria-hidden="true" />
          {t("app.locale")}
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => setLocale("en")}
          role="menuitemradio"
          aria-checked={locale === "en"}
        >
          <DropdownMenuCheck visible={locale === "en"} />
          {t("app.locale.english")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setLocale("zh-CN")}
          role="menuitemradio"
          aria-checked={locale === "zh-CN"}
        >
          <DropdownMenuCheck visible={locale === "zh-CN"} />
          {t("app.locale.chinese")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2">
          <Palette className="h-4 w-4" aria-hidden="true" />
          {t("theme.label")}
        </DropdownMenuLabel>
        {THEME_IDS.map((themeId) => (
          <DropdownMenuItem
            key={themeId}
            onSelect={() => setTheme(themeId)}
            role="menuitemradio"
            aria-checked={theme === themeId}
          >
            <DropdownMenuCheck visible={theme === themeId} />
            {themeLabel(themeId)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DesktopNavigation() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const activeSection = navigationSection(pathname);
  return (
    <nav
      className="hidden items-center gap-1 xl:flex"
      aria-label={t("nav.primaryLabel")}
    >
      {NAVIGATION_SECTIONS.map((section) => {
        const active = activeSection?.path === section.path;
        return (
          <Button
            key={section.path}
            variant={active ? "secondary" : "ghost"}
            asChild
            className={cn(
              "h-9 px-3",
              active && "bg-primary/10 text-primary hover:bg-primary/20"
            )}
          >
            <Link
              to={section.items[0]?.path ?? section.path}
              aria-current={active ? "page" : undefined}
            >
              {t(section.labelKey)}
            </Link>
          </Button>
        );
      })}
      <Button
        variant={pathname === APP_PATHS.imports ? "secondary" : "ghost"}
        asChild
        className={cn(
          "h-9 px-3",
          pathname === APP_PATHS.imports &&
            "bg-primary/10 text-primary hover:bg-primary/20"
        )}
      >
        <Link
          to={APP_PATHS.imports}
          aria-current={pathname === APP_PATHS.imports ? "page" : undefined}
        >
          {t(DATA_SOURCES_NAV.labelKey)}
        </Link>
      </Button>
    </nav>
  );
}

function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { t } = useI18n();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="-ml-2 xl:hidden">
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">{t("nav.menu")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex flex-col"
        closeLabel={t("common.close")}
      >
        <SheetTitle className="flex items-center gap-2 pr-8">
          <img src="/assets/ggstarrail/mark.svg" className="h-7 w-7" alt="" />
          GG Artifact
          <span className="text-sm font-normal text-primary">
            {t("site.starRail.short")}
          </span>
        </SheetTitle>
        <SheetDescription>{t("app.tagline")}</SheetDescription>
        <nav
          className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto"
          aria-label={t("nav.primaryLabel")}
        >
          {NAVIGATION_SECTIONS.map((section) => (
            <section key={section.path}>
              <h2
                className={cn(
                  "mb-1 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground",
                  navigationSection(pathname)?.path === section.path &&
                    "text-primary"
                )}
              >
                {t(section.labelKey)}
              </h2>
              <div className="space-y-1 border-l border-border pl-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.path}
                      variant={pathname === item.path ? "secondary" : "ghost"}
                      asChild
                      className="h-9 w-full justify-start"
                      onClick={() => setOpen(false)}
                    >
                      <Link
                        to={item.path}
                        aria-current={
                          pathname === item.path ? "page" : undefined
                        }
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {t(item.labelKey)}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            </section>
          ))}
          <Button
            variant={pathname === APP_PATHS.imports ? "secondary" : "ghost"}
            asChild
            className="h-9 w-full justify-start"
            onClick={() => setOpen(false)}
          >
            <Link
              to={APP_PATHS.imports}
              aria-current={pathname === APP_PATHS.imports ? "page" : undefined}
            >
              <DATA_SOURCES_NAV.icon className="h-4 w-4" aria-hidden="true" />
              {t(DATA_SOURCES_NAV.labelKey)}
            </Link>
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function SectionTabs() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const section = navigationSection(pathname);
  if (!section) return null;

  return (
    <div
      className="hidden shrink-0 border-b border-border/50 bg-card/20 backdrop-blur-sm md:block"
      data-testid="section-tabs"
    >
      <div className="container mx-auto max-w-full overflow-x-auto px-4 pb-2 scrollbar-none">
        <nav
          className="mx-auto flex w-max items-center gap-1 rounded-lg bg-muted p-1"
          aria-label={
            section.path === "/archive"
              ? t("archive.tabs.label")
              : t(section.labelKey)
          }
        >
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.path;
            return (
              <Button
                key={item.path}
                variant={active ? "default" : "ghost"}
                asChild
                className={cn(
                  "h-9 gap-2 px-3 text-sm",
                  active &&
                    "bg-primary/60 text-primary-foreground hover:bg-primary/70"
                )}
              >
                <NavLink to={item.path}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t(item.labelKey)}
                </NavLink>
              </Button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const showAccountImport =
    navigationSection(pathname)?.path === "/account-data";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gradient-page text-foreground">
      <header className="z-50 h-14 shrink-0 bg-card/20 backdrop-blur-sm">
        <div className="container mx-auto flex h-14 items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden md:gap-3">
            <MobileMenu />
            <SiteSwitcher />
            <DesktopNavigation />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {showAccountImport && (
              <AccountImportAction
                variant="outline"
                compactOnMobile
                className="bg-background/70"
              />
            )}
            <ThemeAndLocaleMenu />
          </div>
        </div>
      </header>
      <SectionTabs />
      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="container mx-auto min-w-0 max-w-full space-y-4 px-4 py-3 2xl:py-4">
          {children}
        </div>
      </main>
    </div>
  );
}
