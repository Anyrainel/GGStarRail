import {
  Check,
  ChevronDown,
  CircleUserRound,
  Download,
  ExternalLink,
  HeartHandshake,
  Languages,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  MoreVertical,
  Palette,
} from "lucide-react";
import { type ReactNode, useState } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { getAssetUrl } from "@/lib/assets";
import { cn } from "@/lib/utils";

const GENSHIN_SITE_URL =
  import.meta.env.VITE_GENSHIN_SITE_URL ?? "https://ggartifact.com";

function SiteSwitcher() {
  const { t } = useI18n();
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Link
        to={APP_PATHS.home}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("app.name")}
        title={t("site.home")}
      >
        <img src={getAssetUrl("logo-hsr.svg")} className="h-8 w-8" alt="" />
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-10 w-auto gap-2 rounded-md px-2 hover:bg-accent/50 focus-visible:ring-2 data-[state=open]:bg-accent/50 min-[360px]:w-36 sm:w-auto sm:min-w-56"
            aria-label={t("site.switcher.label")}
          >
            <span className="hidden text-lg font-semibold sm:inline">
              {t("app.name")}
            </span>
            <span className="ml-auto whitespace-nowrap rounded-md border border-primary/35 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
              {t("site.starRail.short")}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-0"
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
            <Link to={APP_PATHS.home} aria-current="true">
              <img
                src={getAssetUrl("logo-hsr.svg")}
                className="h-7 w-7"
                alt=""
              />
              <span className="min-w-0 flex-1 font-medium">
                {t("site.starRail")}
              </span>
              <Check className="shrink-0 text-primary" aria-hidden="true" />
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function AccountMenu({ onImport }: { onImport: () => void }) {
  const { t } = useI18n();
  const auth = useAuth();
  const [actionFailed, setActionFailed] = useState(false);
  async function authenticate(action: () => Promise<void>) {
    setActionFailed(false);
    try {
      await action();
    } catch {
      setActionFailed(true);
    }
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("nav.account")}
            className="h-9 w-9 rounded-full p-0 2xl:mr-4"
          >
            <CircleUserRound className="size-5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {auth.isAuthenticated ? (
            <DropdownMenuItem disabled className="max-w-64 truncate">
              {auth.label ?? t("auth.signedIn")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={auth.isLoading}
              onSelect={() => void authenticate(auth.signIn)}
            >
              <LogIn className="size-4" aria-hidden />
              {t("auth.signIn")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to={APP_PATHS.feedback}>
              <MessageSquare className="size-4" aria-hidden />
              {t("account.feedback")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={APP_PATHS.support}>
              <HeartHandshake className="size-4" aria-hidden />
              {t("account.support")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onImport}>
            <Download className="size-4" aria-hidden />
            {t("imports.open")}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={APP_PATHS.scannerDownload}>
              <Download className="size-4" aria-hidden />
              {t("scanner.menu")}
            </Link>
          </DropdownMenuItem>
          {auth.isAuthenticated && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={auth.isLoading}
                onSelect={() => void authenticate(auth.signOut)}
              >
                <LogOut className="size-4" aria-hidden />
                {t("auth.signOut")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {(actionFailed || auth.error) && (
        <div
          role="alert"
          className="absolute right-4 top-full max-w-xs rounded-md border border-destructive bg-card p-3 text-sm text-foreground"
        >
          {t("auth.unavailable")}
        </div>
      )}
    </>
  );
}

function ThemeAndLocaleMenu({
  actions,
  phoneActions,
}: {
  actions: ReactNode;
  /** Items that live in the header from `sm` up (each hides itself there). */
  phoneActions?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t("common.more")}>
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {phoneActions}
        {actions}
        {(actions || phoneActions) && (
          <DropdownMenuSeparator className={cn(!actions && "sm:hidden")} />
        )}
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
      className="hidden items-center gap-2 xl:flex"
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
              "h-9 gap-1 px-3 pb-2.5 pt-1.5",
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
  const { pathname, search } = useLocation();
  const { t } = useI18n();
  const activeSection = navigationSection(pathname);
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
        className="flex w-[280px] flex-col"
        closeLabel={t("common.close")}
      >
        <SheetTitle className="flex items-center gap-2 pr-8 text-left">
          <img src={getAssetUrl("logo-hsr.svg")} className="h-6 w-6" alt="" />
          {t("app.name")}
        </SheetTitle>
        <SheetDescription className="sr-only">
          {t("app.tagline")}
        </SheetDescription>
        <nav
          className="mt-4 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto"
          aria-label={t("nav.primaryLabel")}
        >
          {NAVIGATION_SECTIONS.map((section) => {
            const sectionActive = activeSection?.path === section.path;
            return (
              <div key={section.path} className="space-y-0.5">
                <Button
                  variant="ghost"
                  asChild
                  className={cn(
                    "h-9 w-full justify-start gap-2 pb-2.5 pt-1.5 text-sm font-semibold",
                    sectionActive && "text-primary"
                  )}
                  onClick={() => setOpen(false)}
                >
                  <Link to={section.items[0]?.path ?? section.path}>
                    {t(section.labelKey)}
                  </Link>
                </Button>
                <div className="ml-2 border-l border-border pl-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.path;
                    return (
                      <Button
                        key={item.path}
                        variant={active ? "secondary" : "ghost"}
                        asChild
                        className="h-8 w-full justify-start gap-2 pb-2 pt-1 text-sm font-normal"
                        onClick={() => setOpen(false)}
                      >
                        <Link
                          to={
                            section.keepSearch && sectionActive
                              ? { pathname: item.path, search }
                              : item.path
                          }
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {t(item.labelKey)}
                        </Link>
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function SectionTabs() {
  const { pathname, search } = useLocation();
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
                  "h-9 gap-2 px-4 pb-2.5 pt-1.5 text-sm",
                  active &&
                    "bg-primary/60 text-primary-foreground hover:bg-primary/70"
                )}
              >
                <NavLink
                  to={
                    section.keepSearch
                      ? { pathname: item.path, search }
                      : item.path
                  }
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
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
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [importOpen, setImportOpen] = useState(false);
  const [registeredActions, setActions] =
    useState<RegisteredPageActions | null>(null);
  const actions =
    registeredActions?.pathname === pathname ? registeredActions : null;
  const showAccountImport =
    navigationSection(pathname)?.path === "/account-data";
  const hasPageActions = Boolean(
    showAccountImport || actions?.primary || actions?.overflow
  );

  return (
    <PageActionContext.Provider value={setActions}>
      <div className="flex h-dvh flex-col overflow-hidden bg-gradient-page text-foreground">
        <div className="shrink-0 bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">
          {t("app.developmentNotice")}
        </div>
        <header className="z-50 h-14 shrink-0 bg-card/20 backdrop-blur-sm">
          <div className="container mx-auto flex h-14 items-center justify-between gap-2 px-4">
            <div className="flex min-w-0 flex-1 items-center gap-1 md:gap-4">
              <MobileMenu />
              <SiteSwitcher />
              <DesktopNavigation />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {showAccountImport && (
                <AccountImportAction
                  variant="outline"
                  className="hidden bg-background/70 sm:inline-flex"
                />
              )}
              <div className="hidden items-center gap-2 sm:flex">
                {actions?.primary}
              </div>
              {pathname === "/" ? (
                <>
                  <div className="hidden items-center gap-2 sm:flex">
                    <ThemeLocaleControls />
                  </div>
                  <div className="sm:hidden">
                    <ThemeAndLocaleMenu actions={undefined} />
                  </div>
                </>
              ) : (
                <ThemeAndLocaleMenu
                  actions={actions?.overflow}
                  phoneActions={
                    showAccountImport ? (
                      <DropdownMenuItem
                        className="sm:hidden"
                        onSelect={() => setImportOpen(true)}
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        {t("imports.open")}
                      </DropdownMenuItem>
                    ) : undefined
                  }
                />
              )}
              {hasPageActions && (
                <div className="h-6 w-px bg-border" aria-hidden="true" />
              )}
              <AccountMenu onImport={() => setImportOpen(true)} />
            </div>
          </div>
        </header>
        <AccountImportDialog open={importOpen} onOpenChange={setImportOpen} />
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
