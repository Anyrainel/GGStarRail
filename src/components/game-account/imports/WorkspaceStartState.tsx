import type { LucideIcon } from "lucide-react";
import {
  FileJson,
  Globe2,
  KeyRound,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AccountImportAction,
  AccountImportDialog,
} from "@/components/game-account/imports/AccountImportAction";
import type { AccountImportMethod } from "@/components/game-account/imports/AccountImportPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { APP_PATHS } from "@/config/navigation";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";

interface WorkspaceStartStateProps {
  messageKey: MessageKey;
  icon: LucideIcon;
  primaryAction?: "import-account" | "open-account";
  /** What the page needs before it can show results. */
  requires?: "account" | "builds" | "both";
}

const IMPORT_METHODS: readonly {
  method: AccountImportMethod;
  icon: LucideIcon;
  titleKey: MessageKey;
}[] = [
  { method: "json", icon: FileJson, titleKey: "imports.account.title" },
  { method: "uid", icon: Globe2, titleKey: "imports.uid.title" },
  { method: "hoyolab", icon: KeyRound, titleKey: "imports.credentials.title" },
];

const CTA_CLASS = "h-10 gap-2 px-8";

function ImportMethodTiles() {
  const { t } = useI18n();
  const [method, setMethod] = useState<AccountImportMethod | null>(null);
  return (
    <>
      <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-3 text-left sm:grid-cols-2">
        {IMPORT_METHODS.map(({ method: value, icon: Icon, titleKey }) => (
          <button
            key={value}
            type="button"
            onClick={() => setMethod(value)}
            className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card/50 p-3 text-left text-sm font-medium outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
            data-import-method={value}
          >
            <span className="shrink-0 rounded-md bg-primary/10 p-1.5 text-primary">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">{t(titleKey)}</span>
          </button>
        ))}
      </div>
      <AccountImportDialog
        key={method ?? "closed"}
        open={method !== null}
        onOpenChange={(open) => {
          if (!open) setMethod(null);
        }}
        initialMethod={method ?? undefined}
      />
    </>
  );
}

export function WorkspaceStartState({
  messageKey,
  icon,
  primaryAction = "import-account",
  requires,
}: WorkspaceStartStateProps) {
  const { t } = useI18n();
  const need =
    requires ?? (primaryAction === "open-account" ? null : "account");

  const buildsLink = (variant: "default" | "outline") => (
    <Button asChild variant={variant} className={CTA_CLASS}>
      <Link to={APP_PATHS.builds}>
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        {t("empty.openBuilds")}
      </Link>
    </Button>
  );

  return (
    <EmptyState
      messageKey={messageKey}
      icon={icon}
      footer={
        need === "account" || need === "both" ? <ImportMethodTiles /> : null
      }
    >
      {need === null ? (
        <Button asChild className={CTA_CLASS}>
          <Link to={APP_PATHS.characters}>
            <UsersRound className="h-4 w-4" aria-hidden />
            {t("empty.openAccount")}
          </Link>
        </Button>
      ) : need === "builds" ? (
        buildsLink("default")
      ) : (
        <>
          {need === "both" && buildsLink("outline")}
          <AccountImportAction className={CTA_CLASS} />
        </>
      )}
    </EmptyState>
  );
}
