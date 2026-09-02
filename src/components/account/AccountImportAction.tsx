import { Download } from "lucide-react";
import { useState } from "react";
import { AccountImportPanel } from "@/components/account/AccountImportPanel";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
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
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
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
      {open && (
        <ResponsiveDialogContent closeLabel={t("common.close")}>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t("imports.dialog.title")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("imports.dialog.description")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="mt-4">
            <AccountImportPanel />
          </div>
        </ResponsiveDialogContent>
      )}
    </ResponsiveDialog>
  );
}
