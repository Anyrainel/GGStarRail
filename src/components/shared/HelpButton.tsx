import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
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

interface HelpButtonProps {
  /** Dialog title. */
  title: string;
  /** Rules and restrictions shown in the dialog. */
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/** A small help icon that opens rules and restrictions in a responsive dialog. */
export function HelpButton({
  title,
  children,
  className,
  contentClassName,
}: HelpButtonProps) {
  const { t } = useI18n();
  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("common.help")}
          title={t("common.help")}
          className={cn("h-7 w-7 text-muted-foreground", className)}
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        closeLabel={t("common.close")}
        aria-describedby={undefined}
        className={cn("md:max-w-lg", contentClassName)}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="mt-3 space-y-3 text-sm leading-6">{children}</div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
