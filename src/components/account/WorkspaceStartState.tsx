import type { LucideIcon } from "lucide-react";
import { Database, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { AccountImportAction } from "@/components/account/AccountImportAction";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";

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
        <Button asChild variant="ghost">
          <Link to={APP_PATHS.imports}>
            <Database className="h-4 w-4" aria-hidden />
            {t("imports.help.open")}
          </Link>
        </Button>
      </div>
    </EmptyState>
  );
}
