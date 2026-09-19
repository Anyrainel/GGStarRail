import { Filter } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useI18n } from "@/i18n/I18nContext";

/** The tier workspace shares Genshin's constrained toolbar and full-width body. */
export function WideLayout({
  title,
  actions,
  filters,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <header className="sticky top-0 z-10 shrink-0 pb-2 2xl:pb-4">
        <div className="container flex items-center justify-between gap-4">
          <div className="flex min-w-0 max-w-[calc(100%-3.5rem)] shrink-0 items-center gap-4 md:max-w-[60%]">
            <h1 className="truncate text-xl font-bold md:text-2xl">{title}</h1>
            {actions}
          </div>
          {filters && (
            <>
              <div className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-4 md:flex">
                {filters}
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 md:hidden"
                  >
                    <Filter className="h-4 w-4" />
                    <span className="sr-only">
                      {t("tier.controls.filters")}
                    </span>
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  closeLabel={t("common.close")}
                  aria-describedby={undefined}
                >
                  <SheetTitle>{t("tier.controls.filters")}</SheetTitle>
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    {filters}
                  </div>
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
