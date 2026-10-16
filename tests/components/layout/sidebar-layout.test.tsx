import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { I18nProvider } from "@/i18n/I18nContext";

describe("SidebarLayout scrolling", () => {
  it.each([false, true])(
    "forwards gap wheel events to the content (internal scroller: %s)",
    (internal) => {
      function Workspace() {
        const ref = useRef<HTMLDivElement>(null);
        return (
          <I18nProvider>
            <SidebarLayout
              sidebar={<p>Filters</p>}
              contentScrollsInternally={internal}
              contentScrollRef={ref}
            >
              <div ref={ref} data-testid="list">
                Items
              </div>
            </SidebarLayout>
          </I18nProvider>
        );
      }
      const { container } = render(<Workspace />);
      const list = screen.getByTestId("list");
      const scroller = internal ? list : list.parentElement!;
      const scrollBy = vi.fn();
      Object.defineProperties(scroller, {
        scrollHeight: { value: 2000 },
        clientHeight: { value: 400 },
        scrollBy: { value: scrollBy },
      });
      fireEvent.wheel(container.firstElementChild!, { deltaY: 200 });
      expect(scrollBy).toHaveBeenCalledWith({ top: 200, behavior: "auto" });
      // Events inside the list are handled by native scrolling, not forwarded.
      fireEvent.wheel(list, { deltaY: 200 });
      expect(scrollBy).toHaveBeenCalledTimes(1);
    }
  );
});
