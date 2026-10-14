import { type ComponentProps, type ReactNode, useState } from "react";
import {
  type AccountImportMethod,
  AccountImportPanel,
} from "@/components/game-account/imports/AccountImportPanel";
import { ImportIcon } from "@/components/shared/importExportIcons";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

interface AccountImportActionProps {
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
  compactOnMobile?: boolean;
  appBar?: boolean;
  /** The import method opened first. */
  initialMethod?: AccountImportMethod;
}

/**
 * Keeps account import available from the Account Data shell without making
 * Data Sources a required workflow step. The panel is unmounted when closed,
 * which also drops any partially entered transient credential material.
 */
export function AccountImportAction({
  variant = "default",
  size = "default",
  className,
  compactOnMobile = false,
  appBar = false,
  initialMethod,
}: AccountImportActionProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <AccountImportDialog
      open={open}
      onOpenChange={setOpen}
      initialMethod={initialMethod}
    >
      <ResponsiveDialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          aria-label={compactOnMobile ? t("imports.open") : undefined}
        >
          <ImportIcon className="h-4 w-4" aria-hidden />
          <span className={cn(compactOnMobile && "hidden sm:inline")}>
            {appBar ? t("common.import") : t("imports.open")}
          </span>
        </Button>
      </ResponsiveDialogTrigger>
    </AccountImportDialog>
  );
}

export function AccountImportDialog({
  open,
  onOpenChange,
  initialMethod,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMethod?: AccountImportMethod;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      {children}
      {open && (
        <ResponsiveDialogContent
          className="md:max-w-xl"
          aria-describedby={undefined}
          closeLabel={t("common.close")}
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t("imports.dialog.title")}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="mt-4">
            <AccountImportPanel initialMethod={initialMethod} />
          </div>
        </ResponsiveDialogContent>
      )}
    </ResponsiveDialog>
  );
}
