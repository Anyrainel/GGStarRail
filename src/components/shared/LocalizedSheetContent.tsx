import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { SheetClose, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function LocalizedSheetContent({
  className,
  children,
  closeLabel,
  ref,
  ...props
}: ComponentProps<typeof SheetContent> & { closeLabel: string }) {
  return (
    <SheetContent
      ref={(element) => {
        // The Tailwind 3 registry has no close-button override. Hide its
        // built-in control before exposing the localized control below.
        const builtInClose = element?.firstElementChild;
        if (builtInClose instanceof HTMLButtonElement) {
          builtInClose.hidden = true;
          builtInClose.setAttribute("aria-hidden", "true");
        }
        if (typeof ref === "function") return ref(element);
        if (ref) ref.current = element;
      }}
      className={cn("[&>button:first-child]:hidden", className)}
      {...props}
    >
      {children}
      <SheetClose asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4"
          aria-label={closeLabel}
        >
          <X aria-hidden="true" />
        </Button>
      </SheetClose>
    </SheetContent>
  );
}
