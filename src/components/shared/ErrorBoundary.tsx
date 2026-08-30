import { AlertTriangle, Copy, RefreshCw } from "lucide-react";
import React, { type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nContext";
import { redactDiagnostic } from "@/lib/security";

interface ErrorBoundaryProps {
  children: ReactNode;
  title: string;
  hint: string;
  copyLabel: string;
  redactionNote: string;
  refreshLabel: string;
}

interface ErrorBoundaryState {
  failed: boolean;
  diagnostic: string;
}

class RootErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = { failed: false, diagnostic: "" };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { failed: true, diagnostic: redactDiagnostic(error) };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    const diagnostic = [
      redactDiagnostic(error),
      redactDiagnostic(info.componentStack ?? ""),
      `Route: ${window.location.pathname}`,
    ]
      .filter(Boolean)
      .join("\n");
    this.setState({ diagnostic });
    console.error("GGStarRail render failure", diagnostic);
  }

  public render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-4 text-foreground">
        <section className="w-full max-w-xl space-y-5 rounded-2xl border border-destructive/30 bg-card p-6 shadow-glow">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-destructive/15 p-2 text-destructive">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h1 className="font-semibold">{this.props.title}</h1>
              <p className="text-sm leading-6 text-muted-foreground">
                {this.props.hint}
              </p>
            </div>
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background/70 p-3 text-xs text-muted-foreground">
            {this.state.diagnostic}
          </pre>
          <p className="text-xs text-muted-foreground">
            {this.props.redactionNote}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {this.props.refreshLabel}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigator.clipboard?.writeText(this.state.diagnostic)
              }
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              {this.props.copyLabel}
            </Button>
          </div>
        </section>
      </main>
    );
  }
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <RootErrorBoundary
      title={t("error.title")}
      hint={t("error.hint")}
      copyLabel={t("common.copyDetails")}
      redactionNote={t("error.redacted")}
      refreshLabel={t("common.refresh")}
    >
      {children}
    </RootErrorBoundary>
  );
}
