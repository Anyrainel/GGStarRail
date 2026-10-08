import { Download } from "lucide-react";
import { type ReactNode, useState } from "react";
import { AccountImportPanel } from "@/components/account/AccountImportPanel";
import { Button, type ButtonProps } from "@/components/ui/button";
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
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  compactOnMobile?: boolean;
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
}: AccountImportActionProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <AccountImportDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          aria-label={compactOnMobile ? t("imports.open") : undefined}
        >
          <Download className="h-4 w-4" aria-hidden />
          <span className={cn(compactOnMobile && "hidden sm:inline")}>
            {t("imports.open")}
          </span>
        </Button>
      </ResponsiveDialogTrigger>
    </AccountImportDialog>
  );
}

export function AccountImportDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
            <AccountImportPanel />
          </div>
        </ResponsiveDialogContent>
      )}
    </ResponsiveDialog>
  );
}
