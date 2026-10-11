import { Loader2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

interface RunButtonProps {
  label: string;
  running: boolean;
  onRun: () => void;
  /** Cancellable jobs show Stop while running; others show the busy label. */
  onStop?: () => void;
  busyLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** The action that ends a controls row: run, then busy or Stop. */
export function RunButton({
  label,
  running,
  onRun,
  onStop,
  busyLabel,
  disabled,
  className,
}: RunButtonProps) {
  const { t } = useI18n();
  const base =
    "h-6 gap-1 px-2 text-[10px] font-bold md:h-8 md:gap-1.5 md:px-4 md:text-xs";
  if (running && onStop)
    return (
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className={cn(base, className)}
        onClick={onStop}
      >
        <Square className="h-3 w-3 fill-current" aria-hidden />
        {t("teamDmg.stop")}
      </Button>
    );
  return (
    <Button
      type="button"
      size="sm"
      className={cn(base, className)}
      disabled={disabled || running}
      onClick={onRun}
    >
      {running ? (
        <Loader2
          className="h-3 w-3 animate-spin md:h-3.5 md:w-3.5"
          aria-hidden
        />
      ) : (
        <Play className="h-3 w-3 md:h-3.5 md:w-3.5" aria-hidden />
      )}
      {running && busyLabel ? busyLabel : label}
    </Button>
  );
}
