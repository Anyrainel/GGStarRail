import { Clock3 } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { MessageKey } from "@/i18n/messages.en";
import { cn } from "@/lib/utils";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The relative-age message for an import time, or null for an invalid date. */
export function sourceAgeMessage(
  importedAt: string,
  now: number
): { key: MessageKey; count: number } | null {
  const time = Date.parse(importedAt);
  if (!Number.isFinite(time)) return null;
  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE) return { key: "source.age.justNow", count: 0 };
  if (elapsed < HOUR)
    return { key: "source.age.minutes", count: Math.floor(elapsed / MINUTE) };
  if (elapsed < DAY)
    return { key: "source.age.hours", count: Math.floor(elapsed / HOUR) };
  return { key: "source.age.days", count: Math.floor(elapsed / DAY) };
}

interface SourceAgeBadgeProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** ISO timestamp of the import. */
  importedAt: string;
  /** Provider label shown in the tooltip, such as "Scanner export". */
  sourceLabel?: string;
  /** `pill` for title rows; `banner` for a full-width line above content. */
  variant?: "pill" | "banner";
  /** Reference time for the relative age; defaults to the render time. */
  now?: Date;
}

/** How old the imported account data is, with the exact time in the tooltip. */
export function SourceAgeBadge({
  importedAt,
  sourceLabel,
  variant = "pill",
  now,
  className,
  ...props
}: SourceAgeBadgeProps) {
  const { locale, t } = useI18n();
  const message = sourceAgeMessage(importedAt, (now ?? new Date()).getTime());
  const age = message
    ? t(message.key, { count: message.count })
    : t("common.unknown");
  const time = Date.parse(importedAt);
  const absolute = Number.isFinite(time)
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(time))
    : null;
  const title = [absolute, sourceLabel].filter(Boolean).join(" · ");
  const text = t("source.accountData", { age });

  if (variant === "banner") {
    return (
      <div
        title={title || undefined}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card/10 px-3 py-2 text-sm text-muted-foreground",
          className
        )}
        data-source-age="banner"
        {...props}
      >
        <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{text}</span>
        {sourceLabel && (
          <span className="hidden shrink-0 sm:inline">· {sourceLabel}</span>
        )}
      </div>
    );
  }

  return (
    <div
      title={title || undefined}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-card/10 px-2 py-0.5 text-xs font-medium text-muted-foreground",
        className
      )}
      data-source-age="pill"
      {...props}
    >
      <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
      {text}
    </div>
  );
}
