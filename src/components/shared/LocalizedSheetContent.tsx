import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { SheetClose, SheetContent } from "@/components/ui/sheet";

export function LocalizedSheetContent({
  className,
  children,
  closeLabel,
  ref,
  ...props
}: ComponentProps<typeof SheetContent> & { closeLabel: string }) {
  return (
    <SheetContent
      ref={ref}
      className={className}
      {...props}
      showCloseButton={false}
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
