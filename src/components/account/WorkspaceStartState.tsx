import type { LucideIcon } from "lucide-react";
import { Database, FlaskConical, UsersRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AccountImportAction } from "@/components/account/AccountImportAction";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { createDemoAccount } from "@/lib/demoAccount";
import { redactDiagnostic } from "@/lib/security";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

interface WorkspaceStartStateProps {
  messageKey: MessageKey;
  icon: LucideIcon;
  detailKey?: MessageKey;
  primaryAction?: "import-account" | "open-account";
}

export function WorkspaceStartState({
  messageKey,
  icon,
  detailKey,
  primaryAction = "import-account",
}: WorkspaceStartStateProps) {
  const { t } = useI18n();
  const replaceAccount = useWorkspaceStore((state) => state.replaceAccount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const loadDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      replaceAccount(await createDemoAccount());
    } catch (reason: unknown) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <EmptyState messageKey={messageKey} icon={icon}>
      {detailKey && (
        <p className="max-w-lg text-sm leading-6 text-muted-foreground">
          {t(detailKey)}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        {primaryAction === "open-account" ? (
          <Button asChild>
            <Link to={APP_PATHS.characters}>
              <UsersRound className="h-4 w-4" aria-hidden />
              {t("empty.openAccount")}
            </Link>
          </Button>
        ) : (
          <AccountImportAction />
        )}
        <Button
          type="button"
          variant="outline"
          onClick={loadDemo}
          disabled={busy}
        >
          <FlaskConical className="h-4 w-4" aria-hidden />
          {busy ? t("common.loading") : t("imports.demo.load")}
        </Button>
        <Button asChild variant="ghost">
          <Link to={APP_PATHS.imports}>
            <Database className="h-4 w-4" aria-hidden />
            {t("imports.help.open")}
          </Link>
        </Button>
      </div>
      {error !== null && (
        <div
          className="w-full max-w-lg space-y-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-left"
          role="alert"
        >
          <p className="text-sm font-medium">{t("empty.demoError")}</p>
          <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground select-text">
            {redactDiagnostic(error)}
          </pre>
        </div>
      )}
    </EmptyState>
  );
}
