import { type LucideIcon, SlidersHorizontal } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useI18n } from "@/i18n/I18nContext";

interface SidebarLayoutProps {
  sidebar: ReactNode;
  triggerIcon?: LucideIcon;
  triggerLabel: string;
  description: string;
  activeFilterCount?: number;
  children: ReactNode;
}

/** Shared desktop sidebar and mobile filter sheet, adapted from GGArtifact's SidebarLayout. */
export function SidebarLayout({
  sidebar,
  triggerIcon: TriggerIcon = SlidersHorizontal,
  triggerLabel,
  description,
  activeFilterCount = 0,
  children,
}: SidebarLayoutProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="min-w-0 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-2 xl:grid-cols-[17.5rem_minmax(0,1fr)] 2xl:grid-cols-[15rem_minmax(0,1fr)] 3xl:grid-cols-[17.5rem_minmax(0,1fr)] 3xl:gap-3">
      <div className="mb-3 lg:hidden">
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
            side="left"
            closeLabel={t("common.close")}
            className="overflow-y-auto"
          >
            <SheetTitle>{triggerLabel}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
            <div className="mt-4 [&_aside]:border-0 [&_aside]:bg-transparent [&_aside]:p-0 [&_aside]:shadow-none">
              {sidebar}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="hidden min-w-0 lg:block">{sidebar}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
