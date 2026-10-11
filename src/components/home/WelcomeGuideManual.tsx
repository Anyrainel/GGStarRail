import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Database,
  Filter,
  Library,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";
import { WelcomeGuidePreview } from "./WelcomeGuidePreview";
import "./WelcomeGuideManual.css";

export function WelcomeGuideManual() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const steps = [
    {
      id: "account",
      title: t("guide.account.title"),
      icon: Database,
      hint: null,
      actions: [t("guide.account.action1"), t("guide.account.action2")],
      links: [
        { to: APP_PATHS.characters, label: t("imports.open") },
        { to: APP_PATHS.scannerDownload, label: t("guide.scanner") },
      ],
    },
    {
      id: "builds",
      title: t("guide.builds.title"),
      icon: SlidersHorizontal,
      hint: t("guide.builds.hint"),
      actions: [
        t("guide.builds.action1"),
        t("guide.builds.action2"),
        t("guide.builds.action3"),
      ],
      links: [{ to: APP_PATHS.builds, label: t("home.openBuilds") }],
    },
    {
      id: "filters",
      title: t("guide.filters.title"),
      icon: Filter,
      hint: t("guide.filters.hint"),
      actions: [
        t("guide.filters.action1"),
        t("guide.filters.action2"),
        t("guide.filters.action3"),
      ],
      links: [
        { to: APP_PATHS.filters, label: t("nav.filters") },
        { to: APP_PATHS.inventory, label: t("nav.inventory") },
      ],
    },
    {
      id: "decisions",
      title: t("guide.decisions.title"),
      icon: ShieldCheck,
      hint: t("guide.decisions.hint"),
      actions: [
        t("guide.decisions.action1"),
        t("guide.decisions.action2"),
        t("guide.decisions.action3"),
      ],
      links: [
        { to: APP_PATHS.triage, label: t("nav.triage") },
        { to: APP_PATHS.resources, label: t("nav.resources") },
      ],
    },
    {
      id: "more",
      title: t("guide.more.title"),
      icon: Library,
      hint: t("guide.more.hint"),
      actions: [],
      links: [
        { to: APP_PATHS.teamDamage, label: t("nav.teamDamageSection") },
        { to: APP_PATHS.tierCharacters, label: t("nav.tierList") },
        { to: APP_PATHS.archiveCharacters, label: t("nav.archive") },
        {
          to: APP_PATHS.archiveAchievements,
          label: t("nav.archiveAchievements"),
        },
      ],
    },
  ] as const;
  const current = steps[step];
  const Icon = current.icon;
  function navigate(index: number) {
    setStep(index);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setStep(0);
      }}
    >
      <ResponsiveDialogTrigger asChild>
        <Button className="h-11 gap-2.5 px-6 text-lg" variant="outline">
          <Compass className="size-5 text-primary" aria-hidden="true" />
          <span className="guide-text-shimmer">{t("guide.open")}</span>
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        closeLabel={t("common.close")}
        className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 md:w-[min(56rem,calc(100vw-2rem))] md:p-0"
      >
        <div className="shrink-0 border-b border-border px-5 pb-4 pt-6 sm:px-6">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{t("guide.open")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("guide.intro")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <nav
            aria-label={t("guide.contents")}
            className="mt-4 grid grid-cols-5 gap-1 sm:gap-2"
          >
            {steps.map((item, index) => {
              const StepIcon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={index === step ? "step" : undefined}
                  onClick={() => navigate(index)}
                  className={cn(
                    "flex min-w-0 flex-col items-center gap-1.5 rounded-lg border px-1 py-2 text-center text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    index === step
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <StepIcon className="size-4" aria-hidden="true" />
                  <span>{item.title}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div
          ref={contentRef}
          className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6"
          aria-live="polite"
        >
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium text-primary">
                {t("guide.progress", {
                  current: step + 1,
                  total: steps.length,
                })}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{current.title}</h2>
            </div>
          </div>
          <div
            className={cn(
              "grid items-start gap-5",
              current.id !== "more" && "md:grid-cols-[1.15fr_1fr]"
            )}
          >
            {current.id !== "more" && (
              <WelcomeGuidePreview key={current.id} kind={current.id} />
            )}
            <div className="space-y-4">
              {current.actions.length > 0 && (
                <ol className="space-y-3">
                  {current.actions.map((action, index) => (
                    <li key={action} className="flex gap-3 text-sm leading-6">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                        {index + 1}
                      </span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ol>
              )}
              {current.hint && (
                <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-6">
                  {current.hint}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {current.links.map((link) => (
                  <Button
                    key={link.to}
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-10 whitespace-normal"
                  >
                    <Link to={link.to} onClick={() => setOpen(false)}>
                      {link.label}
                      <ArrowUpRight
                        className="size-4 shrink-0"
                        aria-hidden="true"
                      />
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-4 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            disabled={step === 0}
            onClick={() => navigate(step - 1)}
            className="gap-1"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {t("guide.previous")}
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {step + 1} / {steps.length}
          </span>
          <Button
            size="sm"
            className="gap-1"
            onClick={() =>
              step === steps.length - 1 ? setOpen(false) : navigate(step + 1)
            }
          >
            {step === steps.length - 1 ? t("guide.done") : t("guide.next")}
            {step < steps.length - 1 && (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
