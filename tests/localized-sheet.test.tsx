import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { LocalizedSheetContent } from "@/components/shared/LocalizedSheetContent";
import { Sheet, SheetTitle } from "@/components/ui/sheet";

describe("localized sheet", () => {
  it.each([
    "Close",
    "关闭",
  ])("exposes one close control named %s and forwards the content ref", async (closeLabel) => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onOpenChange = vi.fn();
    render(
      <Sheet defaultOpen onOpenChange={onOpenChange}>
        <LocalizedSheetContent
          ref={ref}
          closeLabel={closeLabel}
          aria-describedby={undefined}
        >
          <SheetTitle>Details</SheetTitle>
        </LocalizedSheetContent>
      </Sheet>
    );
    const dialog = screen.getByRole("dialog");
    expect(ref.current).toBe(dialog);
    expect(within(dialog).getAllByRole("button")).toHaveLength(1);
    await user.click(within(dialog).getByRole("button", { name: closeLabel }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(ref.current).toBeNull();
  });
});
