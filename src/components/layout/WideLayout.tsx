import { Filter } from "lucide-react";
import { type ReactNode, useState } from "react";
import { LocalizedSheetContent as SheetContent } from "@/components/shared/LocalizedSheetContent";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

export interface WideFilterGroup {
  key: string;
  content: ReactNode;
  /** Optional heading above the group in the mobile sheet. */
  label?: ReactNode;
  /** Chip groups span the full sheet width instead of the two-column grid. */
  fullWidth?: boolean;
}

function isFilterGroups(
  filters: ReactNode | readonly WideFilterGroup[]
): filters is readonly WideFilterGroup[] {
  return (
    Array.isArray(filters) &&
    filters.every(
      (group) =>
        typeof group === "object" &&
        group !== null &&
        "key" in group &&
        "content" in group
    )
  );
}

/** The tier workspace shares Genshin's constrained toolbar and full-width body. */
export function WideLayout({
  title,
  actions,
  filters,
  children,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  /** Filter groups split by dividers, or a single node (older callers). */
  filters?: ReactNode | readonly WideFilterGroup[];
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const [sheetOpen, setSheetOpen] = useState(false);
  const groups = isFilterGroups(filters) ? filters : null;
  const hasFilters = groups ? groups.length > 0 : Boolean(filters);

  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col", className)}>
      <header className="sticky top-0 z-10 shrink-0 pb-2 2xl:pb-4">
        <div className="container flex items-center justify-between gap-4">
          {/* Phones keep the title whole with a tighter gap before actions. */}
          <div className="flex min-w-0 max-w-[calc(100%-3.5rem)] shrink-0 items-center gap-2 sm:gap-4 md:max-w-[60%]">
            <h1 className="truncate text-xl font-bold md:text-2xl">{title}</h1>
            {actions}
          </div>
          {hasFilters && (
            <>
              {groups ? (
                <div
                  className="ml-auto hidden min-w-0 flex-wrap items-center gap-3 md:flex"
                  data-wide-filters
                >
                  {groups.map((group, index) => (
                    <div key={group.key} className="flex items-center gap-3">
                      {index > 0 && (
                        <div
                          className="h-6 w-px shrink-0 bg-border"
                          aria-hidden="true"
                        />
                      )}
                      {group.content}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-4 md:flex"
                  data-wide-filters
                >
                  {filters as ReactNode}
                </div>
              )}
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 md:hidden"
                  >
                    <Filter className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">{t("common.filters")}</span>
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  closeLabel={t("common.close")}
                  aria-describedby={undefined}
                  className="w-80 overflow-y-auto"
                >
                  <SheetTitle>{t("common.filters")}</SheetTitle>
                  {groups ? (
                    <div className="mt-4 space-y-3">
                      {groups.map((group) => (
                        <div key={group.key} className="space-y-2">
                          {group.label && (
                            <div className="text-sm font-medium">
                              {group.label}
                            </div>
                          )}
                          <div
                            className={cn(
                              group.fullWidth
                                ? "flex flex-wrap gap-1"
                                : "grid grid-cols-2 gap-x-4 gap-y-2"
                            )}
                          >
                            {group.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      {filters as ReactNode}
                    </div>
                  )}
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 md:px-6 xl:px-8 2xl:px-12"
        data-wide-content
      >
        {children}
      </div>
    </div>
  );
}
