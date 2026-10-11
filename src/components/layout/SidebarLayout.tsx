import { Filter, type LucideIcon } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useGlobalScroll } from "@/hooks/useGlobalScroll";
import { useI18n } from "@/i18n/I18nContext";

interface SidebarLayoutProps {
  sidebar: ReactNode;
  triggerIcon?: LucideIcon;
  /** Mobile trigger and sheet title; defaults to "Filters". */
  triggerLabel?: string;
  activeFilterCount?: number;
  children: ReactNode;
}

/** Shared desktop sidebar and mobile filter sheet, adapted from GGArtifact's SidebarLayout. */
export function SidebarLayout({
  sidebar,
  triggerIcon: TriggerIcon = Filter,
  triggerLabel,
  activeFilterCount = 0,
  children,
}: SidebarLayoutProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  useGlobalScroll(containerRef, mainRef);
  const label = triggerLabel ?? t("common.filters");
  return (
    <div
      ref={containerRef}
      className="wide-container flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden pb-3 lg:flex-row lg:gap-3"
    >
      <div className="shrink-0 lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="gap-2">
              <TriggerIcon className="h-4 w-4" aria-hidden="true" />
              {label}
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            aria-describedby={undefined}
            side="left"
            closeLabel={t("common.close")}
            className="w-80 p-0"
          >
            <div className="flex h-16 items-center gap-2 border-b border-border p-4 pr-12">
              <TriggerIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <SheetTitle className="truncate">{label}</SheetTitle>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto overscroll-contain p-3">
              {sidebar}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <aside className="relative hidden min-w-0 shrink-0 overflow-y-auto overscroll-contain lg:block lg:w-60 xl:w-[17.5rem] 2xl:w-60 3xl:w-[17.5rem]">
        {sidebar}
      </aside>
      <div
        ref={mainRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {children}
      </div>
    </div>
  );
}
