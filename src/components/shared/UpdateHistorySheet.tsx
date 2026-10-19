import { Megaphone } from "lucide-react";
import type { ReactNode } from "react";
import { LocalizedSheetContent } from "@/components/shared/LocalizedSheetContent";
import { NewsText } from "@/components/shared/NewsText";
import { Sheet, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/I18nContext";
import { updateLogs } from "@/services/content/updateLog";

export function UpdateHistorySheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
}) {
  const { locale, t } = useI18n();
  const news = updateLogs[locale];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children}
      <LocalizedSheetContent
        side="right"
        closeLabel={t("common.close")}
        aria-describedby={undefined}
        className="w-[min(400px,85vw)] gap-0 p-0"
      >
        <SheetHeader className="shrink-0 border-b border-border px-5 pb-3 pt-5">
          <SheetTitle className="flex items-center gap-2">
            <Megaphone className="size-4 text-primary" aria-hidden />
            {t("whatsNew.title")}
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {news.roadmap.length > 0 && (
            <section>
              <h3 className="mb-2 font-semibold text-primary">
                {t("whatsNew.roadmap")}
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {news.roadmap.map((item) => (
                  <li key={item}>
                    <NewsText onNavigate={() => onOpenChange(false)}>
                      {item}
                    </NewsText>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {news.entries.map((entry) => (
            <article key={entry.date} className="space-y-3">
              <h3 className="border-b border-border pb-2 font-mono font-semibold">
                <time dateTime={entry.date}>{entry.date}</time>
              </h3>
              {entry.sections.map((section) => (
                <section key={section.category}>
                  <h4 className="mb-2 text-sm font-semibold text-primary">
                    {section.category === "features"
                      ? t("whatsNew.features")
                      : t("whatsNew.fixes")}
                  </h4>
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                    {section.items.map((item) => (
                      <li key={item}>
                        <NewsText onNavigate={() => onOpenChange(false)}>
                          {item}
                        </NewsText>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </article>
          ))}
          {news.entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("whatsNew.empty")}
            </p>
          )}
        </div>
      </LocalizedSheetContent>
    </Sheet>
  );
}
