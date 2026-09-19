import { type LucideIcon, SlidersHorizontal } from "lucide-react";
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
  triggerLabel: string;
  activeFilterCount?: number;
  children: ReactNode;
}

/** Shared desktop sidebar and mobile filter sheet, adapted from GGArtifact's SidebarLayout. */
export function SidebarLayout({
  sidebar,
  triggerIcon: TriggerIcon = SlidersHorizontal,
  triggerLabel,
  activeFilterCount = 0,
  children,
}: SidebarLayoutProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  useGlobalScroll(containerRef, mainRef);
  return (
    <div
      ref={containerRef}
      className="wide-container flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden pb-3 lg:flex-row lg:gap-3"
    >
      <div className="shrink-0 lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <TriggerIcon className="h-4 w-4" aria-hidden="true" />
              {triggerLabel}
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            aria-describedby={undefined}
            side="left"
            closeLabel={t("common.close")}
            className="overflow-y-auto"
          >
            <SheetTitle>{triggerLabel}</SheetTitle>
            <div className="mt-4 [&_aside]:border-0 [&_aside]:bg-transparent [&_aside]:p-0 [&_aside]:shadow-none">
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
