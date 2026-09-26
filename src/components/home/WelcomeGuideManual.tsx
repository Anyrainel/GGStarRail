import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Database,
  Filter,
  Library,
  Trophy,
} from "lucide-react";
import { useState } from "react";
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
import "./WelcomeGuideManual.css";

// Adapt the GGArtifact welcome guide's step navigation and manual entry point.
export function WelcomeGuideManual() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: t("nav.accountData"),
      icon: Database,
      body: t("guide.account.body"),
      hint: t("guide.account.hint"),
      links: [
        { to: APP_PATHS.characters, label: t("home.openAccount") },
        { to: APP_PATHS.inventory, label: t("nav.inventory") },
      ],
    },
    {
      title: t("nav.planning"),
      icon: Filter,
      body: t("guide.builds.body"),
      hint: t("guide.builds.hint"),
      links: [
        { to: APP_PATHS.builds, label: t("nav.builds") },
        { to: APP_PATHS.filters, label: t("nav.filters") },
      ],
    },
    {
      title: t("nav.tierList"),
      icon: Trophy,
      body: t("guide.priority.body"),
      hint: t("guide.priority.hint"),
      links: [
        { to: APP_PATHS.tierCharacters, label: t("nav.tierCharacters") },
        { to: APP_PATHS.tierLightCones, label: t("nav.tierLightCones") },
        { to: APP_PATHS.tierRelics, label: t("nav.tierRelics") },
      ],
    },
    {
      title: t("nav.archive"),
      icon: Library,
      body: t("guide.archive.body"),
      hint: t("guide.archive.hint"),
      links: [
        { to: APP_PATHS.archiveCharacters, label: t("nav.archiveCharacters") },
        { to: APP_PATHS.archiveLightCones, label: t("nav.archiveLightCones") },
        { to: APP_PATHS.archiveRelicSets, label: t("nav.archiveRelicSets") },
      ],
    },
  ];
  const current = steps[step];
  const Icon = current.icon;
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setStep(0);
      }}
    >
      <ResponsiveDialogTrigger asChild>
        <Button className="h-11 gap-2.5 bg-black px-6 text-lg text-foreground hover:bg-black/80">
          <Compass className="size-5" aria-hidden="true" />
          <span className="guide-text-shimmer">{t("guide.open")}</span>
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        closeLabel={t("common.close")}
        className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 md:w-[min(48rem,calc(100vw-2rem))] md:p-0"
      >
        <div className="overflow-y-auto px-6 pb-5 pt-6">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="flex items-center gap-2">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              {current.title}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("guide.progress", { current: step + 1, total: steps.length })}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="mt-5 space-y-4">
            <p className="text-sm leading-6 text-foreground">{current.body}</p>
            <div className="grid gap-2 rounded-lg border-2 border-primary/50 bg-primary/5 p-3 sm:grid-cols-2">
              {current.links.map((link) => (
                <Button
                  key={link.to}
                  asChild
                  variant="outline"
                  className="h-auto min-h-11 justify-between whitespace-normal text-left"
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
            <p className="text-sm leading-6 text-muted-foreground">
              {current.hint}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-4 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
            className="gap-1"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {t("guide.previous")}
          </Button>
          <div className="flex">
            {steps.map((item, index) => (
              <button
                key={item.title}
                type="button"
                aria-label={item.title}
                aria-current={index === step ? "step" : undefined}
                onClick={() => setStep(index)}
                className="flex size-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "size-2 rounded-full transition-colors",
                    index === step ? "bg-primary" : "bg-border"
                  )}
                />
              </button>
            ))}
          </div>
          <Button
            size="sm"
            className="gap-1"
            onClick={() =>
              step === steps.length - 1 ? setOpen(false) : setStep(step + 1)
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
