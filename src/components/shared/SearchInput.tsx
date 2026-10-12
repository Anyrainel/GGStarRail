import { Search, X } from "lucide-react";
import { type ComponentPropsWithoutRef, forwardRef } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { cn } from "@/lib/utils";

interface SearchInputProps
  extends Omit<
    ComponentPropsWithoutRef<"input">,
    "type" | "value" | "onChange" | "size"
  > {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name of the search box. */
  label: string;
  /** `prominent`: a centered page search; `sidebar`: a compact field with a clear button. */
  variant?: "prominent" | "sidebar";
  wrapperClassName?: string;
}

/** A search box with the native cancel button hidden. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onValueChange,
      label,
      variant = "sidebar",
      className,
      wrapperClassName,
      ...props
    },
    ref
  ) => {
    const { t } = useI18n();
    const prominent = variant === "prominent";
    return (
      <div
        className={cn(
          "relative",
          prominent && "mx-auto w-full max-w-2xl",
          wrapperClassName
        )}
      >
        <Search
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
            prominent ? "left-3.5 h-[18px] w-[18px]" : "left-2.5 h-4 w-4"
          )}
          aria-hidden="true"
        />
        <input
          ref={ref}
          type="search"
          value={value}
          aria-label={label}
          onChange={(event) => onValueChange(event.target.value)}
          className={cn(
            "w-full border border-border text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-search-cancel-button]:appearance-none",
            prominent
              ? "h-11 rounded-xl bg-card/50 pl-10 pr-3 text-base shadow-xs md:text-sm"
              : "h-9 rounded-md bg-background pl-8 pr-8 text-sm",
            className
          )}
          {...props}
        />
        {!prominent && value && (
          <button
            type="button"
            aria-label={t("common.clear")}
            title={t("common.clear")}
            onClick={() => onValueChange("")}
            className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-hidden hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";
