import {
  ArrowRight,
  ChevronDown,
  Download,
  ExternalLink,
  Languages,
  Menu,
  MoreVertical,
  Palette,
  UserRound,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  AccountImportAction,
  AccountImportDialog,
} from "@/components/account/AccountImportAction";
import {
  PageActionContext,
  type RegisteredPageActions,
} from "@/components/layout/PageActions";
import {
  LocaleChoices,
  ThemeChoices,
  ThemeLocaleControls,
} from "@/components/layout/ThemeLocaleControls";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  NAVIGATION_SECTIONS,
  navigationSection,
} from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { getAssetUrl } from "@/lib/assets";
import { cn } from "@/lib/utils";

const GENSHIN_SITE_URL =
  import.meta.env.VITE_GENSHIN_SITE_URL ?? "https://ggartifact.com";

function SiteSwitcher() {
  const { t } = useI18n();
  const brandRef = useRef<HTMLAnchorElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [alignOffset, setAlignOffset] = useState(0);
  return (
    <div className="flex shrink-0 items-center gap-1 md:gap-3">
      <Link
        ref={brandRef}
        to={APP_PATHS.home}
        className="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("home.brand")}
      >
        <img src={getAssetUrl("logo-hsr.svg")} className="h-8 w-8" alt="" />
        <span className="hidden text-base sm:inline">GGArtifact</span>
      </Link>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open && brandRef.current && triggerRef.current) {
            setAlignOffset(
              Math.round(
                brandRef.current.getBoundingClientRect().left -
                  triggerRef.current.getBoundingClientRect().left
              )
            );
          }
        }}
      >
        <div ref={triggerRef}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 min-w-0 gap-1.5 rounded-md px-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground focus-visible:bg-accent/70 focus-visible:ring-0 data-[state=open]:bg-accent/50 data-[state=open]:text-foreground"
              aria-label={t("site.switcher.label")}
            >
              <span className="rounded-md border border-primary/35 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                {t("site.starRail.short")}
              </span>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent
          align="start"
          alignOffset={alignOffset}
          className="w-max min-w-48"
        >
          <DropdownMenuItem asChild>
            <a
              href={GENSHIN_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={getAssetUrl("logo-gi.svg")}
                className="h-7 w-7"
                alt=""
              />
              <span className="min-w-0 flex-1 font-medium">
                {t("site.genshin")}
              </span>
              <ExternalLink
                className="text-muted-foreground"
                aria-hidden="true"
              />
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={APP_PATHS.home} aria-current="page">
              <img
                src={getAssetUrl("logo-hsr.svg")}
                className="h-7 w-7"
                alt=""
              />
              <span className="min-w-0 flex-1 font-medium">
                {t("site.starRail")}
              </span>
              <ArrowRight className="text-primary" aria-hidden="true" />
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function AccountMenu() {
  const { t } = useI18n();
  const [importOpen, setImportOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("nav.account")}>
            <UserRound className="size-5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setImportOpen(true)}>
            <Download className="size-4" aria-hidden />
            {t("imports.open")}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={APP_PATHS.scannerDownload}>
              <Download className="size-4" aria-hidden />
              {t("scanner.menu")}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AccountImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}

function ThemeAndLocaleMenu({ actions }: { actions: ReactNode }) {
  const { t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t("common.more")}>
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions}
        {actions && <DropdownMenuSeparator />}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages className="h-4 w-4" aria-hidden="true" />
            {t("app.locale")}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <LocaleChoices />
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="h-4 w-4" aria-hidden="true" />
            {t("theme.label")}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <ThemeChoices />
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
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
          <img src={getAssetUrl("logo-hsr.svg")} className="h-7 w-7" alt="" />
          GGArtifact
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
      <div className="container mx-auto overflow-x-auto pb-2 scrollbar-none">
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
  const [registeredActions, setActions] =
    useState<RegisteredPageActions | null>(null);
  const actions =
    registeredActions?.pathname === pathname ? registeredActions : null;
  const showAccountImport =
    navigationSection(pathname)?.path === "/account-data";

  return (
    <PageActionContext.Provider value={setActions}>
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
              <div className="hidden items-center gap-2 sm:flex">
                {actions?.primary}
              </div>
              {pathname === "/" ? (
                <ThemeLocaleControls />
              ) : (
                <ThemeAndLocaleMenu actions={actions?.overflow} />
              )}
              <AccountMenu />
            </div>
          </div>
        </header>
        <SectionTabs />
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden pt-2 2xl:pt-4">
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col"
            data-testid="app-content"
          >
            {children}
          </div>
        </main>
      </div>
    </PageActionContext.Provider>
  );
}
