import { RotateCcw } from "lucide-react";
import { type ReactNode, useState } from "react";
import { PageActions } from "@/components/layout/PageActions";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useI18n } from "@/i18n/I18nContext";

interface TierPageActionsProps {
  primary: ReactNode;
  overflow: ReactNode;
  assignedCount: number;
  totalCount: number;
  onReset: () => void;
}

export function TierPageActions({
  primary,
  overflow,
  assignedCount,
  totalCount,
  onReset,
}: TierPageActionsProps) {
  const { t } = useI18n();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
      <PageActions
        primary={primary}
        overflow={
          <>
            {overflow}
            <DropdownMenuItem
              disabled={assignedCount === 0}
              onSelect={() => setResetOpen(true)}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t("tier.priority.reset")}
            </DropdownMenuItem>
          </>
        }
      />
      <p className="sr-only">
        {t("tier.priority.summary", {
          assigned: assignedCount,
          pool: Math.max(0, totalCount - assignedCount),
        })}
      </p>

      <ResponsiveDialog open={resetOpen} onOpenChange={setResetOpen}>
        <ResponsiveDialogContent
          closeLabel={t("common.close")}
          className="md:max-w-md"
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t("tier.priority.resetTitle")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t("tier.priority.resetDescription")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onReset();
                setResetOpen(false);
              }}
            >
              {t("tier.priority.reset")}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
