import { type ReactNode, useCallback, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/I18nContext";

const NARROW_ARCHIVE_QUERY = "(max-width: 1023px)";

export function useCatalogDetailSheet() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openOnNarrowScreen = useCallback((trigger: HTMLElement) => {
    if (!window.matchMedia(NARROW_ARCHIVE_QUERY).matches) return;
    triggerRef.current = trigger;
    setOpen(true);
  }, []);

  const restoreTriggerFocus = useCallback((event: Event) => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    event.preventDefault();
    trigger.focus();
  }, []);

  return { open, setOpen, openOnNarrowScreen, restoreTriggerFocus };
}

export function CatalogDetailSheet({
  open,
  onOpenChange,
  onCloseAutoFocus,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={t("common.close")}
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        className="w-full max-w-2xl overflow-y-auto p-3 pt-12 sm:p-5 sm:pt-12"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
