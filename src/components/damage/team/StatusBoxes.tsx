import type { LucideIcon } from "lucide-react";
import { Swords } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

/** A dashed placeholder inside a section card (no results yet, nothing to run). */
export function InlineEmptyBox({
  icon: Icon = Swords,
  children,
  className,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground",
        className
      )}
    >
      <Icon className="h-8 w-8" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** A failed run, shown where its results would appear. */
export function ErrorBox({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm",
        className
      )}
    >
      <span className="font-bold">{t("teamDmg.error")}: </span>
      {children}
    </div>
  );
}
