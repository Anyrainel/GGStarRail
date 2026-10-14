import { FileDown, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageActionButton, PageActions } from "@/components/layout/PageActions";
import { ExportIcon, ImportIcon } from "@/components/shared/importExportIcons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useI18n } from "@/i18n/I18nContext";

interface TierPageActionsProps {
  assignedCount: number;
  totalCount: number;
  exporting: boolean;
  onImport: () => void;
  onExport: () => void;
  onDownloadImage: () => void;
  onReset: () => void;
}

/** Import in the app bar (in More below `sm`); Export, Reset and Download image in More. */
export function TierPageActions({
  assignedCount,
  totalCount,
  exporting,
  onImport,
  onExport,
  onDownloadImage,
  onReset,
}: TierPageActionsProps) {
  const { t } = useI18n();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
      <PageActions
        primary={
          <PageActionButton
            icon={ImportIcon}
            label={t("common.import")}
            onClick={onImport}
          />
        }
        overflow={
          <>
            <DropdownMenuItem className="sm:hidden" onSelect={onImport}>
              <ImportIcon className="h-4 w-4" aria-hidden="true" />
              {t("common.import")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onExport}>
              <ExportIcon className="h-4 w-4" aria-hidden="true" />
              {t("common.export")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={exporting} onSelect={onDownloadImage}>
              <FileDown className="h-4 w-4" aria-hidden="true" />
              {t("tier.controls.image")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={assignedCount === 0}
              className="text-destructive focus:text-destructive"
              onSelect={() => setResetOpen(true)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
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
