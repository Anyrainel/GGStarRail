import { RotateCcw, ShieldCheck } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useI18n } from "@/i18n/I18nContext";

interface PriorityWorkspaceHeaderProps {
  assignedCount: number;
  totalCount: number;
  onReset: () => void;
  filters?: ReactNode;
}

export function PriorityWorkspaceHeader({
  assignedCount,
  totalCount,
  onReset,
  filters,
}: PriorityWorkspaceHeaderProps) {
  const { t } = useI18n();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              <span className="mt-0.5 rounded-lg bg-primary/15 p-2 text-primary">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 space-y-1">
                <h2 className="text-sm font-semibold">
                  {t("tier.priority.notice.title")}
                </h2>
                <p className="max-w-4xl text-xs leading-5 text-muted-foreground">
                  {t("tier.priority.notice.body")}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={assignedCount === 0}
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t("tier.priority.reset")}
            </Button>
          </div>
          <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium tabular-nums">
                {t("tier.priority.summary", {
                  assigned: assignedCount,
                  pool: Math.max(0, totalCount - assignedCount),
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("tier.priority.instructions")}
              </p>
            </div>
            {filters}
          </div>
        </CardContent>
      </Card>

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
