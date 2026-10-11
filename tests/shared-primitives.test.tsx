import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox, Swords } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PageActionButton } from "@/components/layout/PageActions";
import {
  SidebarClearButton,
  SidebarPanel,
  SidebarSection,
} from "@/components/layout/SidebarPanel";
import { WideLayout } from "@/components/layout/WideLayout";
import { CategoryChip } from "@/components/shared/CategoryChip";
import { Checkbox, CheckboxRow } from "@/components/shared/Checkbox";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { HelpButton } from "@/components/shared/HelpButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import {
  type SortDirection,
  SortToggleGroup,
} from "@/components/shared/SortToggleGroup";
import {
  SourceAgeBadge,
  sourceAgeMessage,
} from "@/components/shared/SourceAgeBadge";
import { Switch } from "@/components/shared/Switch";
import { I18nProvider } from "@/i18n/I18nContext";

function withI18n(node: React.ReactNode) {
  return render(<I18nProvider>{node}</I18nProvider>);
}

describe("EmptyState", () => {
  it("renders a borderless page hero with the message as the title", () => {
    const { container } = withI18n(
      <EmptyState messageKey="empty.characters" icon={Inbox}>
        <button type="button">Import</button>
      </EmptyState>
    );
    const root = container.querySelector("[data-empty-state]")!;
    expect(root).toHaveAttribute("data-empty-state", "page");
    expect(root).not.toHaveClass("border-dashed");
    expect(
      screen.getByRole("heading", { level: 2, name: "No account imported." })
    ).toHaveClass("text-2xl");
    expect(
      screen.getByRole("button", { name: "Import" }).parentElement
    ).toHaveClass("sm:flex-row");
  });

  it("shows a restriction line under a separate title", () => {
    withI18n(
      <EmptyState
        titleKey="route.characters.title"
        messageKey="empty.characters"
        footer={<p>Footer</p>}
      />
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Characters" })
    ).toBeVisible();
    expect(screen.getByText("No account imported.").tagName).toBe("P");
    expect(screen.getByText("Footer")).toBeVisible();
  });

  it("offers a quiet inline variant without a heading", () => {
    const { container } = withI18n(
      <EmptyState messageKey="empty.filtered" icon={Swords} variant="inline" />
    );
    expect(container.querySelector("[data-empty-state]")).toHaveClass("py-8");
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("No items match these filters.")).toBeVisible();
  });
});

describe("SortToggleGroup", () => {
  it("switches between off, ascending and descending", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<SortDirection>("off");
      return <SortToggleGroup value={value} onChange={setValue} label="SPD" />;
    }
    withI18n(<Harness />);
    const group = screen.getByRole("group", { name: "SPD" });
    expect(
      within(group).getByRole("button", { name: "No sorting" })
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(within(group).getByRole("button", { name: "Descending" }));
    expect(
      within(group).getByRole("button", { name: "Descending" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(group).getByRole("button", { name: "No sorting" })
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("explains why it is disabled", () => {
    withI18n(
      <SortToggleGroup
        value="off"
        onChange={vi.fn()}
        label="CRIT DMG"
        disabled
        disabledReason="Not available"
      />
    );
    const ascending = screen.getByRole("button", { name: "Ascending" });
    expect(ascending).toBeDisabled();
    expect(ascending).toHaveAttribute("title", "Not available");
  });
});

describe("SegmentedTabs", () => {
  it("moves selection and focus with arrows, Home and End", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<"a" | "b" | "c">("a");
      return (
        <SegmentedTabs
          label="Mode"
          value={value}
          onValueChange={setValue}
          items={[
            { value: "a", label: "Alpha", count: 3 },
            { value: "b", label: "Beta" },
            { value: "c", label: "Gamma" },
          ]}
        />
      );
    }
    render(<Harness />);
    const alpha = screen.getByRole("tab", { name: "Alpha 3" });
    expect(screen.getByRole("tablist", { name: "Mode" })).toBeVisible();
    expect(alpha).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute(
      "tabindex",
      "-1"
    );
    alpha.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Alpha 3" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Alpha 3" })).toHaveFocus();
  });

  it("supports full-width and small lists", () => {
    render(
      <SegmentedTabs
        label="Kind"
        value="x"
        onValueChange={vi.fn()}
        fullWidth
        size="sm"
        items={[
          { value: "x", label: "X" },
          { value: "y", label: "Y" },
        ]}
      />
    );
    expect(screen.getByRole("tablist")).toHaveClass("grid", "h-8");
  });
});

describe("form primitives", () => {
  it("keeps the native checkbox behaviour behind the custom look", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <>
        <CheckboxRow label="Owned only" onCheckedChange={onCheckedChange} />
        <Checkbox aria-label="Bare" defaultChecked />
      </>
    );
    await user.click(screen.getByText("Owned only"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("checkbox", { name: "Owned only" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Bare" })).toHaveClass(
      "appearance-none"
    );
  });

  it("toggles a switch", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [on, setOn] = useState(false);
      return <Switch checked={on} onCheckedChange={setOn} label="Show Paths" />;
    }
    render(<Harness />);
    const toggle = screen.getByRole("switch", { name: "Show Paths" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("shows category chips with a check or a minus", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container } = render(
      <CategoryChip active={false} onClick={onClick} label="Physical" />
    );
    const chip = screen.getByRole("button", { name: "Physical" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector(".lucide-minus")).not.toBeNull();
    await user.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("clears the sidebar search but not the prominent one", async () => {
    const user = userEvent.setup();
    function Harness({ variant }: { variant: "sidebar" | "prominent" }) {
      const [value, setValue] = useState("Kafka");
      return (
        <SearchInput
          label={`Search ${variant}`}
          variant={variant}
          value={value}
          onValueChange={setValue}
        />
      );
    }
    withI18n(
      <>
        <Harness variant="sidebar" />
        <Harness variant="prominent" />
      </>
    );
    expect(screen.getAllByRole("button", { name: "Clear" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(
      screen.getByRole("searchbox", { name: "Search sidebar" })
    ).toHaveValue("");
    expect(
      screen.getByRole("searchbox", { name: "Search prominent" })
    ).toHaveClass("h-11", "rounded-xl");
  });
});

describe("source age and help", () => {
  it("describes how old imported data is", () => {
    const now = Date.parse("2026-10-11T12:00:00Z");
    expect(sourceAgeMessage("2026-10-11T11:59:30Z", now)).toEqual({
      key: "source.age.justNow",
      count: 0,
    });
    expect(sourceAgeMessage("2026-10-11T11:15:00Z", now)?.count).toBe(45);
    expect(sourceAgeMessage("2026-10-11T07:00:00Z", now)?.key).toBe(
      "source.age.hours"
    );
    expect(sourceAgeMessage("2026-10-08T12:00:00Z", now)).toEqual({
      key: "source.age.days",
      count: 3,
    });
    expect(sourceAgeMessage("not a date", now)).toBeNull();

    withI18n(
      <SourceAgeBadge
        importedAt="2026-10-08T12:00:00Z"
        now={new Date(now)}
        sourceLabel="Scanner export"
        variant="banner"
        role="region"
        aria-label="Imported source coverage"
      />
    );
    const banner = screen.getByRole("region", {
      name: "Imported source coverage",
    });
    expect(banner).toHaveTextContent("Account data: 3 d ago");
    expect(banner.getAttribute("title")).toContain("Scanner export");
  });

  it("opens rules in a dialog from the help button", async () => {
    const user = userEvent.setup();
    withI18n(
      <HelpButton title="Rules">
        <p>Only 5-star Relics at +12 or higher.</p>
      </HelpButton>
    );
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.getByRole("dialog", { name: "Rules" })).toHaveTextContent(
      "Only 5-star Relics"
    );
  });
});

describe("filters and page chrome", () => {
  it("supports single-select chip groups with counts", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [selected, setSelected] = useState<Set<string>>(new Set());
      return (
        <>
          <output data-testid="value">{[...selected].join(",")}</output>
          <FilterChipGroup
            options={["a", "b"]}
            selectedValues={selected}
            onSelectedValuesChange={setSelected}
            getKey={(option) => option}
            getLabel={(option) => option}
            getCount={(option) => (option === "a" ? 2 : 5)}
            singleSelect
          />
        </>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "a 2" }));
    await user.click(screen.getByRole("button", { name: "b 5" }));
    expect(screen.getByTestId("value")).toHaveTextContent("b");
    await user.click(screen.getByRole("button", { name: "b 5" }));
    expect(screen.getByTestId("value")).toBeEmptyDOMElement();
  });

  it("renders a visible title row with extras and a hidden one without", () => {
    const { unmount } = withI18n(
      <PageHeader titleKey="route.characters.title">
        <span>(12)</span>
      </PageHeader>
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.parentElement).toHaveClass("flex", "pb-2");
    expect(screen.getByText("(12)")).toBeVisible();
    unmount();
    withI18n(<PageHeader titleKey="route.characters.title" visuallyHidden />);
    expect(screen.getByRole("heading", { level: 1 }).parentElement).toHaveClass(
      "sr-only"
    );
  });

  it("builds sidebar panels and header actions from shared parts", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onClick = vi.fn();
    render(
      <>
        <SidebarPanel label="Character filters">
          <SidebarSection
            title="Path"
            action={<SidebarClearButton label="Clear" onClick={onClear} />}
          >
            <p>Options</p>
          </SidebarSection>
        </SidebarPanel>
        <PageActionButton icon={Swords} label="New team" onClick={onClick} />
      </>
    );
    expect(
      screen.getByRole("complementary", { name: "Character filters" })
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Path" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "New team" }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "New team" })).toHaveClass(
      "h-9",
      "px-3"
    );
  });

  it("separates grouped wide-layout filters and still accepts one node", async () => {
    const user = userEvent.setup();
    const { container, unmount } = withI18n(
      <WideLayout
        title="Character Priority"
        filters={[
          { key: "a", content: <span>Group A</span> },
          { key: "b", content: <span>Group B</span>, label: "Rarity" },
        ]}
      >
        Body
      </WideLayout>
    );
    expect(
      container.querySelectorAll("header .h-6.w-px.bg-border")
    ).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Filters" }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    expect(within(sheet).getByText("Rarity")).toBeVisible();
    expect(within(sheet).getByText("Group A").parentElement).toHaveClass(
      "grid-cols-2"
    );
    unmount();

    withI18n(
      <WideLayout title="Old" filters={<span>Legacy filters</span>}>
        Body
      </WideLayout>
    );
    expect(screen.getByText("Legacy filters")).toBeInTheDocument();
  });
});
