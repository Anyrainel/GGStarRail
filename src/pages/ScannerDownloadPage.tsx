import {
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  FileJson,
  Monitor,
  ScanLine,
  Wifi,
  X,
} from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Button } from "@/components/ui/button";
import {
  CAPTURE_DOWNLOAD,
  OCR_DOWNLOAD,
  SCANNER_RELEASES,
} from "@/config/scannerDownload";
import { useI18n } from "@/i18n/I18nContext";
import { getAssetUrl } from "@/lib/assets";
import { cn } from "@/lib/utils";

export default function ScannerDownloadPage() {
  const { t } = useI18n();
  const features = [
    { label: t("scanner.captureFeature"), needsCapture: true },
    { label: t("scanner.ocrFeature"), needsCapture: false },
    { label: t("scanner.exportFeature"), needsCapture: false },
    { label: t("scanner.managerFeature"), needsCapture: false },
  ];
  const versions = [
    {
      name: "GGScanner",
      primary: true,
      capture: true,
      icon: Wifi,
      description: t("scanner.captureDescription"),
      href: CAPTURE_DOWNLOAD,
    },
    {
      name: "GGScannerOCR",
      primary: false,
      capture: false,
      icon: ScanLine,
      description: t("scanner.ocrDescription"),
      href: OCR_DOWNLOAD,
    },
  ];
  const setup = [
    { title: t("scanner.stepOneTitle"), description: t("scanner.stepOneBody") },
    { title: t("scanner.stepTwoTitle"), description: t("scanner.stepTwoBody") },
    {
      title: t("scanner.stepThreeTitle"),
      description: t("scanner.stepThreeBody"),
    },
  ];
  const files = [
    { label: t("scanner.gameData"), href: "good/hsr_data_cache.json" },
    {
      label: t("scanner.achievementData"),
      href: "good/mapping_achievements.json",
    },
  ];
  return (
    <PageLayout>
      <ScrollLayout bodyClassName="px-4 py-6 md:py-8">
        <div className="mx-auto w-full max-w-5xl space-y-8 md:space-y-10">
          <header className="mx-auto max-w-3xl space-y-3 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-foreground">
              <Monitor className="size-4" aria-hidden />
              {t("scanner.platform")}
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              GGScanner
            </h1>
            <p className="text-xl font-medium sm:text-2xl">
              {t("scanner.tagline")}
            </p>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-foreground/80">
              {t("scanner.introduction")}
            </p>
          </header>

          <section
            aria-label={t("scanner.editions")}
            className="grid gap-5 md:grid-cols-2"
          >
            {versions.map((version) => {
              const Icon = version.icon;
              return (
                <article
                  key={version.name}
                  className={cn(
                    "flex flex-col rounded-2xl bg-gradient-card p-6 sm:p-7",
                    version.primary
                      ? "border-2 border-primary shadow-lg"
                      : "border border-border shadow-sm"
                  )}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <Icon className="size-7 text-primary" aria-hidden />
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs",
                        version.primary
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "bg-secondary font-medium text-secondary-foreground"
                      )}
                    >
                      {version.primary
                        ? t("scanner.recommended")
                        : t("scanner.ocrEdition")}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold">{version.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-foreground/80">
                    {version.description}
                  </p>
                  <ul className="my-5 flex-1 space-y-3">
                    {features.map((feature) => {
                      const included = version.capture || !feature.needsCapture;
                      const FeatureIcon = included ? Check : X;
                      return (
                        <li
                          key={feature.label}
                          className="flex items-start gap-3 text-sm leading-6"
                        >
                          <FeatureIcon
                            className={cn(
                              "mt-1 size-4 shrink-0",
                              included ? "text-primary" : "text-foreground/70"
                            )}
                            aria-hidden
                          />
                          <span className="sr-only">
                            {included
                              ? t("scanner.included")
                              : t("scanner.notIncluded")}
                            :{" "}
                          </span>
                          <span>{feature.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <Button
                    asChild
                    size="default"
                    variant={version.primary ? "default" : "secondary"}
                    className="h-11 w-full gap-2"
                  >
                    <a href={version.href}>
                      <Download className="size-4" aria-hidden />
                      {version.primary
                        ? t("scanner.downloadCapture")
                        : t("scanner.downloadOcr")}
                    </a>
                  </Button>
                </article>
              );
            })}
          </section>

          <div className="flex flex-col items-center gap-3 text-center text-sm">
            <p className="text-foreground/80">{t("scanner.choiceNote")}</p>
            <a
              href={SCANNER_RELEASES}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
            >
              {t("scanner.allReleases")}
              <ExternalLink className="size-4" aria-hidden />
            </a>
          </div>

          <section
            aria-labelledby="scanner-start"
            className="border-t border-border pt-8"
          >
            <h2 id="scanner-start" className="mb-6 text-xl font-semibold">
              {t("scanner.setupTitle")}
            </h2>
            <ol className="grid gap-6 md:grid-cols-3">
              {setup.map((step, index) => (
                <li key={step.title} className="space-y-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                  <p className="text-sm leading-6 text-foreground/80">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-labelledby="scanner-files"
            className="border-t border-border pt-8"
          >
            <h2 id="scanner-files" className="text-lg font-semibold">
              {t("scanner.resourcesTitle")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-foreground/80">
              {t("scanner.resourcesDescription")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {files.map((file) => (
                <a
                  key={file.href}
                  href={getAssetUrl(file.href)}
                  download
                  className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-4 text-sm transition-colors hover:bg-secondary"
                >
                  <FileJson
                    className="size-5 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 font-medium">
                    {file.label}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      JSON
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                </a>
              ))}
            </div>
          </section>
        </div>
      </ScrollLayout>
    </PageLayout>
  );
}
