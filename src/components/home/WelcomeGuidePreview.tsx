import {
  Check,
  ChevronDown,
  FileJson,
  Gem,
  Smartphone,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

// Illustrative only: never read or change the player's account or builds.
export function WelcomeGuidePreview({
  kind,
}: {
  kind: "account" | "builds" | "filters" | "decisions" | "more";
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(0);
  const sources = [
    {
      title: t("imports.account.title"),
      icon: FileJson,
      detail: t("guide.preview.json"),
    },
    {
      title: t("imports.uid.title"),
      icon: Smartphone,
      detail: t("guide.preview.uid"),
    },
  ];
  const decisions = [
    {
      title: t("nav.triage"),
      labels: [t("triage.keep"), t("triage.review"), t("triage.salvageReview")],
      detail: t("guide.preview.triage"),
    },
    {
      title: t("nav.resources"),
      labels: [
        t("resource.action.levelUp"),
        t("resource.action.synthesize"),
        t("resource.action.reroll"),
      ],
      detail: t("guide.preview.resources"),
    },
  ];
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-border bg-gradient-card">
      <figcaption className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3 text-xs">
        <span className="font-semibold">{t("guide.preview.title")}</span>
        <span className="text-muted-foreground">
          {t("guide.preview.example")}
        </span>
      </figcaption>
      <div className="space-y-4 p-4">
        {kind === "account" && (
          <>
            <div className="flex items-center gap-2 rounded-lg border-2 border-primary/50 bg-primary/5 p-3 text-sm font-semibold">
              <FileJson className="size-4 text-primary" aria-hidden />
              {t("imports.open")}
              <ChevronDown className="ml-auto size-4" aria-hidden />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {sources.map((source, index) => (
                <button
                  key={source.title}
                  type="button"
                  aria-pressed={selected === index}
                  onClick={() => setSelected(index)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected === index
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  )}
                >
                  <source.icon className="size-5 text-primary" aria-hidden />
                  {source.title}
                </button>
              ))}
            </div>
            <p className="text-sm leading-6">{sources[selected].detail}</p>
            <div className="flex items-center gap-2 border-t border-border pt-3 text-xs">
              <Check className="size-4 shrink-0 text-primary" aria-hidden />
              {t("guide.preview.review")}
            </div>
          </>
        )}
        {kind === "builds" && (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UserRound className="size-5 text-primary" aria-hidden />
              {t("guide.preview.build")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[t("build.cavernCards"), t("build.planarCards")].map(
                (label, index) => (
                  <div
                    key={label}
                    className="rounded-lg border border-border bg-background/50 p-3"
                  >
                    <p className="text-xs font-medium">{label}</p>
                    <div className="mt-3 flex gap-1">
                      {(index === 0
                        ? ["head", "hands", "body", "feet"]
                        : ["sphere", "rope"]
                      ).map((slot) => (
                        <Gem
                          key={slot}
                          className="size-5 text-primary"
                          aria-hidden
                        />
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
            <div className="rounded-lg border border-border bg-background/50 p-3">
              <p className="mb-3 text-xs font-semibold">
                {t("scoring.weightsTitle")}
              </p>
              {[
                { label: t("guide.preview.speed"), width: "100%" },
                { label: t("guide.preview.break"), width: "80%" },
                { label: t("guide.preview.hp"), width: "30%" },
              ].map(({ label, width }) => (
                <div key={label} className="mb-2 last:mb-0">
                  <div className="mb-1 flex justify-between gap-2 text-xs">
                    <span>{label}</span>
                    <span className="tabular-nums">{width}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {t("guide.preview.weights")}
            </p>
          </>
        )}
        {kind === "filters" && (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Gem className="size-5 text-primary" aria-hidden />
              {t("filters.rulesTitle")}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                t("guide.preview.head"),
                t("guide.preview.hands"),
                t("guide.preview.body"),
                t("guide.preview.feet"),
                t("guide.preview.sphere"),
                t("guide.preview.rope"),
              ].map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-primary/40 bg-primary/5 px-2 py-3 text-center text-xs"
                >
                  <Gem
                    className="mx-auto mb-2 size-5 text-primary"
                    aria-hidden
                  />
                  {label}
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-background/50 p-3">
              <p className="mb-2 text-xs font-semibold">
                {t("guide.preview.match")}
              </p>
              {[
                t("filters.sets"),
                t("filters.mainStats"),
                t("filters.weightedStats"),
                t("filters.minimumScore"),
              ].map((label) => (
                <div
                  key={label}
                  className="flex items-center gap-2 py-1 text-xs"
                >
                  <Check className="size-3.5 text-primary" aria-hidden />
                  {label}
                </div>
              ))}
            </div>
          </>
        )}
        {kind === "decisions" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {decisions.map((decision, index) => (
                <button
                  key={decision.title}
                  type="button"
                  aria-pressed={selected === index}
                  onClick={() => setSelected(index)}
                  className={cn(
                    "rounded-lg border px-2 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected === index
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  )}
                >
                  {decision.title}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {decisions[selected].labels.map((label) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Gem className="size-4" aria-hidden />
                  </span>
                  <span className="text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-sm leading-6">{decisions[selected].detail}</p>
          </>
        )}
        {kind === "more" && (
          <div className="space-y-3">
            {[
              { title: t("nav.tierList"), body: t("guide.preview.priority") },
              { title: t("nav.archive"), body: t("guide.preview.archive") },
              {
                title: t("nav.archiveAchievements"),
                body: t("guide.preview.achievements"),
              },
            ].map(({ title, body }) => (
              <div
                key={title}
                className="rounded-lg border border-border bg-background/50 p-3"
              >
                <p className="text-sm font-semibold text-primary">{title}</p>
                <p className="mt-1 text-xs leading-5">{body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
