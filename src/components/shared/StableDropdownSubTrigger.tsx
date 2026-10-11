import type { ComponentProps } from "react";
import { DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";

export function StableDropdownSubTrigger({
  onPointerLeave,
  ...props
}: ComponentProps<typeof DropdownMenuSubTrigger>) {
  return (
    <DropdownMenuSubTrigger
      {...props}
      onPointerLeave={(event) => {
        event.preventDefault();
        onPointerLeave?.(event);
      }}
    />
  );
}
