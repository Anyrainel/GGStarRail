import { Layers } from "lucide-react";
import { ImportIcon } from "@/components/shared/importExportIcons";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useI18n } from "@/i18n/I18nContext";

interface PresetImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  options: readonly { id: string; label: string }[];
  onSelect: (id: string) => void;
  onLocalImport: () => void;
  disabled?: boolean;
  error?: string;
  selectedId?: string;
  onDetach?: () => void;
}

export function PresetImportDialog({
  open,
  onOpenChange,
  title,
  options,
  onSelect,
  onLocalImport,
  disabled = false,
  error,
  selectedId,
  onDetach,
}: PresetImportDialogProps) {
  const { t } = useI18n();
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent
        closeLabel={t("common.cancel")}
        aria-describedby={undefined}
        className="md:w-[min(32rem,calc(100vw-2rem))]"
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              aria-pressed={selectedId === option.id}
              aria-label={
                selectedId === option.id
                  ? `${option.label} ${t("preset.subscribed")}`
                  : option.label
              }
              className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border border-l-4 border-l-primary bg-gradient-card px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onSelect(option.id)}
            >
              <span>
                {option.label}
                {selectedId === option.id && (
                  <span className="ml-2 text-primary">
                    {t("preset.subscribed")}
                  </span>
                )}
              </span>
              <Layers
                className="h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        {selectedId && onDetach && (
          <Button variant="outline" className="mt-3 w-full" onClick={onDetach}>
            {t("preset.unsubscribe")}
          </Button>
        )}
        <div className="mt-4 border-t border-border pt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={onLocalImport}
            disabled={disabled}
          >
            <ImportIcon className="h-4 w-4" aria-hidden="true" />
            {t("preset.fromFile")}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
