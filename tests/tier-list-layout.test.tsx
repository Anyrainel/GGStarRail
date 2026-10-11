import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TierLayout } from "@/components/tier-list/TierLayout";
import type {
  TierGroupConfig,
  TierItemData,
} from "@/components/tier-list/tierTableTypes";
import { I18nProvider } from "@/i18n/I18nContext";

function mockWidth(width: number) {
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
}

const PATHS = [
  "Elation",
  "Preservation",
  "Erudition",
  "Remembrance",
  "Abundance",
  "The Hunt",
  "Harmony",
  "Nihility",
  "Destruction",
].map((name) => ({ id: name, name }));

function renderLayout(
  groups: readonly TierGroupConfig<string>[],
  items: readonly TierItemData<string>[] = []
) {
  const itemsByCell = new Map<string, TierItemData<string>[]>();
  for (const item of items) {
    const key = `${item.group}\0Pool`;
    itemsByCell.set(key, [...(itemsByCell.get(key) ?? []), item]);
  }
  return render(
    <I18nProvider>
      <TierLayout
        presentation={{ title: "", labels: {}, hidden: [] }}
        groups={groups}
        itemsByCell={itemsByCell}
        groupsLabel="Priority groups"
        poolLabel="Pool"
        onSelect={vi.fn()}
      />
    </I18nProvider>
  );
}

function item(
  kind: "character" | "light-cone",
  group: string
): TierItemData<string> {
  return {
    kind,
    id: kind === "character" ? "1001" : "20000",
    sourcePath: "",
    name: kind,
    rarity: 4,
    group,
  };
}

describe("tier category layouts", () => {
  it.each([
    390, 560, 999, 1000, 1920,
  ])("uses category tabs only below 1000px (%ipx)", async (width) => {
    mockWidth(width);
    const { container } = renderLayout([
      { id: "Fire", name: "Fire" },
      { id: "Quantum", name: "Quantum" },
    ]);
    if (width >= 1000) {
      expect(screen.queryByRole("tablist")).toBeNull();
      expect(container.querySelectorAll("[data-priority-tier]")).toHaveLength(
        12
      );
    } else {
      expect(
        screen.getByRole("tablist", { name: "Priority groups" })
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

  it.each([
    [999, "tablet"],
    [1000, "tablet"],
    [1279, "tablet"],
    [1280, "desktop"],
  ])("keeps the nine Paths behind tabs until 1280px (%ipx)", (width, mode) => {
    mockWidth(width);
    const { container } = renderLayout(PATHS);
    expect(container.querySelector("[data-tier-layout]")).toHaveAttribute(
      "data-tier-layout",
      mode
    );
    expect(screen.queryAllByRole("tab")).toHaveLength(
      mode === "desktop" ? 0 : 9
    );
  });

  it.each([
    390, 640,
  ])("names only the active Path tab below 768px (%ipx)", async (width) => {
    mockWidth(width);
    renderLayout(
      PATHS.map((path) => ({
        ...path,
        asset: { kind: "path" as const, id: path.id, sourcePath: "" },
      }))
    );
    const hunt = screen.getByRole("tab", { name: "The Hunt" });
    expect(hunt).toHaveAttribute("title", "The Hunt");
    expect(hunt.querySelector("span")).toHaveClass("sr-only", "md:not-sr-only");
    expect(hunt.querySelector("span")).not.toHaveClass("truncate");
    expect(hunt.querySelector("img")).toHaveAttribute("loading", "eager");
    expect(hunt.querySelector("img")).toHaveAttribute("decoding", "sync");
    const active = screen.getByRole("tab", { name: "Elation" });
    expect(active.querySelector("span")).not.toHaveClass("sr-only");
    await userEvent.setup().click(hunt);
    expect(hunt.querySelector("span")).not.toHaveClass("sr-only");
    expect(active.querySelector("span")).toHaveClass("sr-only");
  });

  it("moves between group tabs with arrow keys and links the panel", async () => {
    mockWidth(390);
    const { container } = renderLayout(PATHS.slice(0, 3));
    const user = userEvent.setup();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", tabs[0]?.id);
    for (const tab of tabs) {
      expect(tab).toHaveAttribute("aria-controls", panel.id);
    }
    tabs[0]?.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Preservation" })).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
    expect(panel).toHaveAttribute("aria-labelledby", tabs[1]?.id);
    await user.keyboard("{End}");
    expect(tabs[2]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tabs[0]).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(tabs[2]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(
      container.querySelector('[data-priority-group="Elation"]')
    ).not.toBeNull();
  });

  it.each([
    [2, ["text-base", "xl:text-lg"]],
    [7, ["text-sm", "xl:text-base", "2xl:text-lg"]],
    [9, ["text-xs", "2xl:text-sm"]],
  ] as const)("sizes desktop headers for %i groups", (groupCount, classes) => {
    mockWidth(1440);
    renderLayout(PATHS.slice(0, groupCount));
    expect(screen.getByText("Elation (0)")).toHaveClass(...classes);
  });

  it("stacks phone tiers as cards with a neutral body", () => {
    mockWidth(390);
    const { container } = renderLayout([
      { id: "Imaginary", name: "Imaginary" },
      { id: "Fire", name: "Fire" },
    ]);
    const tab = screen.getByRole("tab", { name: "Imaginary" });
    expect(tab).not.toHaveAttribute("title");
    expect(tab.querySelector("span")).not.toHaveClass("sr-only");
    const cell = container.querySelector<HTMLElement>(
      '[data-priority-tier="S"]'
    );
    expect(cell).toHaveClass("bg-card/50", "justify-start");
    expect(cell?.style.backgroundColor).toBe("");
    expect(screen.queryByText(/drop here/i)).toBeNull();
  });

  it.each([
    [390, "character", 2, "sm"],
    [768, "character", 2, "md"],
    [1440, "character", 7, "md"],
    [1920, "character", 7, "lg"],
    [390, "light-cone", 9, "xs"],
    [768, "light-cone", 9, "sm"],
    [1279, "light-cone", 9, "sm"],
    [1280, "light-cone", 9, "sm"],
    [1440, "light-cone", 9, "sm"],
    [1536, "light-cone", 9, "md"],
    [1920, "light-cone", 9, "md"],
  ] as const)("sizes icons at %ipx for %s lists of %i groups", (width, kind, groupCount, size) => {
    mockWidth(width);
    const groups = PATHS.slice(0, groupCount);
    const { container } = renderLayout(groups, [item(kind, groups[0].id)]);
    const button = container.querySelector("[data-priority-item-id]");
    expect(button).toHaveAttribute("data-priority-item-size", size);
    expect(button).toHaveClass(
      { xs: "w-10", sm: "w-12", md: "w-14", lg: "w-16" }[size]
    );
  });
});
