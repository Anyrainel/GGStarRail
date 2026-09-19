import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TierLayout } from "@/components/tier-list/TierLayout";

describe("tier category layouts", () => {
  it.each([
    390, 560, 999, 1000, 1920,
  ])("uses category tabs only below 1000px (%ipx)", async (width) => {
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches:
        width >= Number(query.match(/min-width: (\d+)px/)?.[1] ?? Infinity),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const { container } = render(
      <TierLayout
        presentation={{ title: "", labels: {}, hidden: [] }}
        groups={[
          { id: "Fire", name: "Fire" },
          { id: "Quantum", name: "Quantum" },
        ]}
        itemsByCell={new Map()}
        groupsLabel="Combat Types"
        poolLabel="Pool"
        onSelect={vi.fn()}
      />
    );
    if (width >= 1000) {
      expect(screen.queryByRole("tablist")).toBeNull();
      expect(container.querySelectorAll("[data-priority-tier]")).toHaveLength(
        12
      );
    } else {
      expect(
        screen.getByRole("tablist", { name: "Combat Types" })
      ).toBeInTheDocument();
      await userEvent
        .setup()
        .click(screen.getByRole("tab", { name: "Quantum" }));
      expect(screen.getByRole("tab", { name: "Quantum" })).toHaveAttribute(
        "aria-selected",
        "true"
      );
      expect(
        container.querySelectorAll('[data-priority-group="Quantum"]')
      ).toHaveLength(6);
      expect(
        container.querySelector('[data-priority-group="Fire"]')
      ).toBeNull();
    }
  });
});
