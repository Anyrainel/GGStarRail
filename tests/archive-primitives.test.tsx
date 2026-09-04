import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";

const FILTER_OPTIONS = ["unfinished", "finished"] as const;
type FilterOption = (typeof FILTER_OPTIONS)[number];

function setDesktopLayout(isDesktop: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: isDesktop && query === "(min-width: 768px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function ToolbarHarness() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<FilterOption>>(
    () => new Set(["unfinished"])
  );

  return (
    <ArchiveToolbar
      searchQuery={query}
      onSearchChange={setQuery}
      searchLabel="Search achievements"
      searchPlaceholder="Search achievement names and descriptions..."
      filtersLabel="Achievement filters"
    >
      <FilterChipGroup
        options={FILTER_OPTIONS}
        selectedValues={selected}
        onSelectedValuesChange={setSelected}
        getKey={(option) => option}
        getLabel={(option) => option}
        emptyMeansAll={false}
      />
    </ArchiveToolbar>
  );
}

function ChipHarness({
  emptyMeansAll = true,
  collapsible = false,
}: {
  emptyMeansAll?: boolean;
  collapsible?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  return (
    <>
      <output data-testid="selected-values">
        {[...selected].sort().join(",")}
      </output>
      <FilterChipGroup
        label="Status"
        options={["alpha", "beta"]}
        selectedValues={selected}
        onSelectedValuesChange={setSelected}
        getKey={(option) => option}
        getLabel={(option) => option}
        emptyMeansAll={emptyMeansAll}
        collapsible={collapsible}
      />
    </>
  );
}

function LayoutHarness({
  hasSelection,
  onBack = vi.fn(),
}: {
  hasSelection: boolean;
  onBack?: () => void;
}) {
  return (
    <SidebarDetailLayout
      header={<div data-testid="archive-header">Toolbar</div>}
      sidebar={<div>Desktop sidebar</div>}
      mobileGrid={<div>Mobile category grid</div>}
      hasSelection={hasSelection}
      onBack={onBack}
      backLabel="Categories"
      sidebarLabel="Achievement categories"
      detailLabel="Achievement details"
    >
      <div data-testid="archive-detail">Detail content</div>
    </SidebarDetailLayout>
  );
}

describe("ArchiveToolbar", () => {
  it("disables filters only during non-whitespace search and preserves selection", async () => {
    const user = userEvent.setup();
    render(<ToolbarHarness />);

    const search = screen.getByRole("searchbox", {
      name: "Search achievements",
    });
    const unfinished = screen.getByRole("button", { name: "unfinished" });
    const finished = screen.getByRole("button", { name: "finished" });

    expect(unfinished).toBeEnabled();
    expect(unfinished).toHaveAttribute("aria-pressed", "true");

    await user.type(search, "   ");
    expect(unfinished).toBeEnabled();
    expect(finished).toBeEnabled();

    await user.type(search, "jade");
    expect(unfinished).toBeDisabled();
    expect(finished).toBeDisabled();

    await user.clear(search);
    expect(unfinished).toBeEnabled();
    expect(unfinished).toHaveAttribute("aria-pressed", "true");
    expect(finished).toHaveAttribute("aria-pressed", "false");
  });
});

describe("FilterChipGroup", () => {
  it("treats an empty selection as all and toggles explicit values", async () => {
    const user = userEvent.setup();
    render(<ChipHarness />);

    const alpha = screen.getByRole("button", { name: "alpha" });
    const beta = screen.getByRole("button", { name: "beta" });
    expect(alpha).toHaveAttribute("aria-pressed", "true");
    expect(beta).toHaveAttribute("aria-pressed", "true");

    await user.click(alpha);
    expect(screen.getByTestId("selected-values")).toHaveTextContent("alpha");
    expect(alpha).toHaveAttribute("aria-pressed", "true");
    expect(beta).toHaveAttribute("aria-pressed", "false");

    await user.click(alpha);
    expect(screen.getByTestId("selected-values")).toBeEmptyDOMElement();
    expect(alpha).toHaveAttribute("aria-pressed", "true");
    expect(beta).toHaveAttribute("aria-pressed", "true");
  });

  it("can render an empty selection as no active values", () => {
    render(<ChipHarness emptyMeansAll={false} />);

    expect(screen.getByRole("button", { name: "alpha" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "beta" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("shows selected chips while collapsed and all chips when expanded", async () => {
    const user = userEvent.setup();
    render(<ChipHarness collapsible />);

    const disclosure = screen.getByRole("button", { name: "Status" });
    expect(screen.queryByRole("button", { name: "alpha" })).toBeNull();
    expect(screen.queryByRole("button", { name: "beta" })).toBeNull();

    await user.click(disclosure);
    await user.click(screen.getByRole("button", { name: "alpha" }));
    await user.click(disclosure);

    expect(screen.getByRole("button", { name: "alpha" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "beta" })).toBeNull();
  });
});

describe("SidebarDetailLayout", () => {
  it("shows the sidebar and detail together on desktop", () => {
    setDesktopLayout(true);
    render(<LayoutHarness hasSelection={false} />);

    expect(
      document.querySelector('[data-sidebar-detail-layout="desktop"]')
    ).toBeInTheDocument();
    expect(screen.getByText("Desktop sidebar")).toBeVisible();
    expect(screen.getByText("Detail content")).toBeVisible();
    expect(screen.queryByText("Mobile category grid")).toBeNull();
    expect(screen.queryByRole("button", { name: "Categories" })).toBeNull();
    expect(screen.getByTestId("archive-header").parentElement).toHaveClass(
      "pt-px"
    );
  });

  it("shows the browse view without detail on mobile", () => {
    setDesktopLayout(false);
    render(<LayoutHarness hasSelection={false} />);

    expect(
      document.querySelector('[data-sidebar-detail-layout="mobile-browse"]')
    ).toBeInTheDocument();
    expect(screen.getByText("Mobile category grid")).toBeVisible();
    expect(screen.queryByText("Desktop sidebar")).toBeNull();
    expect(screen.queryByText("Detail content")).toBeNull();
    expect(screen.getByTestId("archive-header").parentElement).toHaveClass(
      "pt-px"
    );
  });

  it("shows Back and detail without the outer toolbar on mobile selection", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    setDesktopLayout(false);
    render(<LayoutHarness hasSelection onBack={onBack} />);

    expect(
      document.querySelector('[data-sidebar-detail-layout="mobile-detail"]')
    ).toBeInTheDocument();
    expect(screen.queryByTestId("archive-header")).toBeNull();
    expect(screen.queryByText("Mobile category grid")).toBeNull();
    expect(screen.queryByText("Desktop sidebar")).toBeNull();
    expect(screen.getByTestId("archive-detail").parentElement).toHaveClass(
      "pt-px"
    );

    await user.click(screen.getByRole("button", { name: "Categories" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
