import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PickerItem } from "@/components/shared/ItemPicker";
import {
  CavernPlanPicker,
  cavernPlanFromPair,
  PlanarSetPicker,
} from "@/components/shared/relic/CavernPlanPicker";
import { RelicKindIcon } from "@/components/shared/relic/RelicKindIcon";
import {
  RelicSlotChips,
  toggleRelicKind,
  toggleRelicSlot,
} from "@/components/shared/relic/RelicSlotChips";
import {
  RelicSlotGrid,
  RelicSlotPlaceholder,
  resolveRelicSlotGrid,
} from "@/components/shared/relic/RelicSlotGrid";
import {
  CavernBonusIcon,
  CavernPlanIcon,
  PlanarSetIcon,
  SetPlanIcons,
} from "@/components/shared/relic/SetPlanIcon";
import { I18nProvider } from "@/i18n/I18nContext";
import {
  activeBonusTier,
  CAVERN_SLOTS,
  equippedSetSummary,
  PLANAR_SLOTS,
  RELIC_SLOTS,
  type RelicSlotId,
  shortStatKey,
} from "@/lib/relicPresentation";

const SETS: PickerItem[] = [
  { id: "101", name: "Passerby", searchText: "", iconPath: "", rarity: 4 },
  { id: "102", name: "Musketeer", searchText: "", iconPath: "", rarity: 5 },
  { id: "103", name: "Knight", searchText: "", iconPath: "", rarity: 5 },
];
const PLANAR: PickerItem[] = [
  { id: "301", name: "Space Station", searchText: "", iconPath: "", rarity: 5 },
];

function withI18n(node: React.ReactNode) {
  return render(<I18nProvider>{node}</I18nProvider>);
}

describe("relic presentation helpers", () => {
  it("orders the six slots as four Cavern Relics then two Planar Ornaments", () => {
    expect(RELIC_SLOTS).toEqual([
      "head",
      "hands",
      "body",
      "feet",
      "planarSphere",
      "linkRope",
    ]);
    expect(CAVERN_SLOTS).toHaveLength(4);
    expect(PLANAR_SLOTS).toEqual(["planarSphere", "linkRope"]);
  });

  it("maps flat, percent and base properties to short stat keys", () => {
    expect(shortStatKey("HPDelta")).toBe("stat.short.hp");
    expect(shortStatKey("HPAddedRatio")).toBe("stat.short.hpPercent");
    expect(shortStatKey("CriticalChanceBase")).toBe("stat.short.critRate");
    expect(shortStatKey("SPRatioBase")).toBe("stat.short.energyRegen");
    expect(shortStatKey("ThunderAddedRatio")).toBe(
      "stat.short.lightningDamage"
    );
    expect(shortStatKey("NotAProperty")).toBeNull();
  });

  it("reports the active bonus tier rather than the raw piece count", () => {
    expect(activeBonusTier("cavern", 4)).toBe(4);
    expect(activeBonusTier("cavern", 3)).toBe(2);
    expect(activeBonusTier("cavern", 2)).toBe(2);
    expect(activeBonusTier("cavern", 1)).toBeNull();
    expect(activeBonusTier("planar", 2)).toBe(2);
    expect(activeBonusTier("planar", 1)).toBeNull();
  });

  it("summarizes equipped sets as a Cavern plan plus a Planar set", () => {
    const relic = (slot: RelicSlotId, setId: string) => ({ slot, setId });
    expect(
      equippedSetSummary([
        relic("head", "101"),
        relic("hands", "101"),
        relic("body", "101"),
        relic("feet", "102"),
        relic("planarSphere", "301"),
        relic("linkRope", "301"),
      ])
    ).toEqual({
      cavern: [{ setId: "101", tier: 2, pieces: 3 }],
      planar: { setId: "301", tier: 2, pieces: 2 },
    });
    expect(
      equippedSetSummary([
        relic("head", "102"),
        relic("hands", "102"),
        relic("body", "101"),
        relic("feet", "101"),
        relic("planarSphere", "301"),
        relic("linkRope", "302"),
      ])
    ).toEqual({
      cavern: [
        { setId: "101", tier: 2, pieces: 2 },
        { setId: "102", tier: 2, pieces: 2 },
      ],
      planar: null,
    });
    expect(
      equippedSetSummary(CAVERN_SLOTS.map((slot) => relic(slot, "103"))).cavern
    ).toEqual([{ setId: "103", tier: 4, pieces: 4 }]);
  });
});

describe("RelicSlotGrid", () => {
  it("steps icon sizes down before stacking Cavern over Planar", () => {
    expect(resolveRelicSlotGrid(null, "auto", "md")).toEqual({
      layout: "row",
      iconSize: "md",
    });
    expect(resolveRelicSlotGrid(500, "auto", "md").iconSize).toBe("md");
    expect(resolveRelicSlotGrid(340, "auto", "md")).toEqual({
      layout: "row",
      iconSize: "sm",
    });
    expect(resolveRelicSlotGrid(290, "auto", "md")).toEqual({
      layout: "row",
      iconSize: "xs",
    });
    expect(resolveRelicSlotGrid(250, "auto", "md")).toEqual({
      layout: "stacked",
      iconSize: "md",
    });
    expect(resolveRelicSlotGrid(250, "row", "md")).toEqual({
      layout: "row",
      iconSize: "xs",
    });
    expect(resolveRelicSlotGrid(1000, "stacked", "lg")).toEqual({
      layout: "stacked",
      iconSize: "lg",
    });
  });

  it("renders one 4 + 2 row with a divider and an aligned set row", () => {
    const renderSlot = vi.fn((slot: RelicSlotId) => <span>{slot}</span>);
    const { container } = render(
      <RelicSlotGrid
        renderSlot={renderSlot}
        header={{
          cavern: <span>Cavern set</span>,
          planar: <span>Planar set</span>,
        }}
      />
    );
    const grid = container.querySelector("[data-relic-slot-grid]")!;
    expect(grid).toHaveAttribute("data-relic-slot-grid", "row");
    expect(
      [...grid.querySelectorAll("[data-relic-slot]")].map((cell) =>
        cell.getAttribute("data-relic-slot")
      )
    ).toEqual([...RELIC_SLOTS]);
    const divider = grid.querySelector("[data-relic-divider]")!;
    expect(divider.previousElementSibling).toHaveAttribute(
      "data-relic-slot",
      "feet"
    );
    expect(divider.nextElementSibling).toHaveAttribute(
      "data-relic-slot",
      "planarSphere"
    );
    expect(
      grid.querySelector('[data-relic-group-header="cavern"]')
    ).toHaveClass("col-span-4");
    expect(
      grid.querySelector('[data-relic-group-header="planar"]')
    ).toHaveClass("col-span-2");
    expect(renderSlot).toHaveBeenCalledWith("head", "md");
  });

  it("stacks four Cavern slots over the two Planar slots and their set", () => {
    const { container } = render(
      <RelicSlotGrid
        layout="stacked"
        renderSlot={(slot, size) => (
          <RelicSlotPlaceholder label={slot} size={size} />
        )}
        header={{ planar: <span>Planar set</span> }}
      />
    );
    const grid = container.querySelector("[data-relic-slot-grid]")!;
    expect(grid).toHaveAttribute("data-relic-slot-grid", "stacked");
    expect(grid).toHaveClass("grid-cols-4");
    const planarHeader = grid.querySelector(
      '[data-relic-group-header="planar"]'
    )!;
    expect(planarHeader).toHaveTextContent("Planar set");
    expect(planarHeader.previousElementSibling).toHaveAttribute(
      "data-relic-slot",
      "linkRope"
    );
    expect(screen.getByText("planarSphere").parentElement).toHaveClass(
      "border-dashed"
    );
  });
});

describe("set plan icons", () => {
  it("shows an empty tile, a 4-piece badge, or one 2+2 split tile", () => {
    const { rerender } = withI18n(<CavernPlanIcon sets={[]} />);
    expect(screen.getByRole("img", { name: "No set" })).toHaveAttribute(
      "data-set-plan",
      "empty"
    );

    rerender(
      <I18nProvider>
        <CavernPlanIcon sets={[SETS[1]!]} />
      </I18nProvider>
    );
    const four = screen.getByRole("img", { name: "Musketeer 4-piece" });
    expect(four.querySelector("[data-item-badge='4']")).not.toBeNull();

    rerender(
      <I18nProvider>
        <CavernPlanIcon sets={[SETS[0]!, SETS[1]!]} />
      </I18nProvider>
    );
    const split = screen.getByRole("img", {
      name: "Passerby 2-piece + Musketeer 2-piece",
    });
    expect(split).toHaveAttribute("data-set-plan", "split");
    expect(split.querySelectorAll("img")).toHaveLength(2);
    expect(split.querySelector("[data-item-badge='2+2']")).not.toBeNull();
  });

  it("badges worn Cavern bonuses by tier, a lone 2-piece included", () => {
    const { rerender } = withI18n(
      <CavernBonusIcon bonuses={[{ set: SETS[1]!, tier: 2 }]} />
    );
    const lone = screen.getByRole("img", { name: "Musketeer 2-piece" });
    expect(lone).toHaveAttribute("data-set-plan", "two");
    expect(lone.querySelector("[data-item-badge='2']")).not.toBeNull();

    rerender(
      <I18nProvider>
        <CavernBonusIcon bonuses={[{ set: SETS[1]!, tier: 4 }]} />
      </I18nProvider>
    );
    expect(
      screen
        .getByRole("img", { name: "Musketeer 4-piece" })
        .querySelector("[data-item-badge='4']")
    ).not.toBeNull();

    rerender(
      <I18nProvider>
        <CavernBonusIcon
          bonuses={[
            { set: SETS[0]!, tier: 2 },
            { set: SETS[1]!, tier: 2 },
          ]}
        />
      </I18nProvider>
    );
    expect(
      screen.getByRole("img", { name: "Passerby 2-piece + Musketeer 2-piece" })
    ).toHaveAttribute("data-set-plan", "split");
  });

  it("badges Planar Ornament sets with 2 and pairs both plans", () => {
    const { container } = withI18n(
      <SetPlanIcons cavern={[SETS[2]!]} planar={PLANAR[0]!} size="xs" />
    );
    expect(
      screen
        .getByRole("img", { name: "Space Station 2-piece" })
        .querySelector("[data-item-badge='2']")
    ).not.toBeNull();
    expect(container.querySelector("[data-set-plan-icons]")).toHaveClass(
      "gap-0.5"
    );
    render(
      <I18nProvider>
        <PlanarSetIcon set={PLANAR[0]!} showBadge={false} />
      </I18nProvider>
    );
    expect(
      screen
        .getAllByRole("img", { name: "Space Station 2-piece" })[1]!
        .querySelector("[data-item-badge]")
    ).toBeNull();
  });

  it("names the Cavern and Planar kind markers", () => {
    withI18n(
      <>
        <RelicKindIcon kind="cavern" />
        <RelicKindIcon kind="planar" />
      </>
    );
    expect(screen.getByRole("img", { name: "Cavern Relics" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Planar Ornaments" })).toBeVisible();
  });
});

function PlanHarness({
  initial = [],
  onChange,
}: {
  initial?: string[];
  onChange: (next: string[]) => void;
}) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <I18nProvider>
      <CavernPlanPicker
        label="Cavern plan"
        value={value}
        items={SETS}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
        onClear={() => setValue([])}
      />
    </I18nProvider>
  );
}

describe("CavernPlanPicker", () => {
  it("picks a 4-piece set and closes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PlanHarness onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Cavern plan" }));
    expect(screen.getByRole("tab", { name: "4-piece" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await user.click(screen.getByRole("button", { name: "Knight" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(["103"]);
    expect(screen.queryByRole("tab")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Cavern plan: Knight 4-piece" })
    ).toBeInTheDocument();
  });

  it("fills the 1st and 2nd halves of a 2+2 plan before closing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PlanHarness onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Cavern plan" }));
    await user.click(screen.getByRole("tab", { name: "2+2" }));
    const [first, second] = screen.getAllByRole("button", {
      name: /^(1st|2nd)/,
    });
    expect(first).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Passerby" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveTextContent("Passerby");
    await user.click(screen.getByRole("button", { name: "Musketeer" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(["101", "102"]);
    expect(screen.queryByRole("tab")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Cavern plan: Passerby 2-piece + Musketeer 2-piece",
      })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /^Cavern plan: Passerby/ })
    );
    expect(screen.getByRole("tab", { name: "2+2" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    const results = screen.getByRole("dialog");
    expect(
      within(results).getByRole("button", { name: "Passerby" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(results).getByRole("button", { name: "Musketeer" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("collapses the same set picked twice to a 4-piece plan", async () => {
    expect(cavernPlanFromPair("101", "101")).toEqual(["101"]);
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PlanHarness onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Cavern plan" }));
    await user.click(screen.getByRole("tab", { name: "2+2" }));
    await user.click(screen.getByRole("button", { name: "Knight" }));
    await user.click(screen.getByRole("button", { name: "Knight" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(["103"]);
  });

  it("wraps a Planar set picker with its 2-piece trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    withI18n(
      <PlanarSetPicker
        label="Planar Ornaments"
        value="301"
        items={PLANAR}
        onChange={onChange}
        title="Account"
      />
    );
    const trigger = screen.getByRole("button", {
      name: "Planar Ornaments: Space Station 2-piece",
    });
    expect(trigger).toHaveAttribute("title", "Account");
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Space Station" }));
    expect(onChange).toHaveBeenCalledWith("301");
  });
});

describe("RelicSlotChips", () => {
  it("toggles single slots and whole kind groups, with empty meaning all", () => {
    const none = new Set<RelicSlotId>();
    expect([...toggleRelicSlot(none, "body")]).toEqual(["body"]);
    expect([...toggleRelicSlot(new Set(["body"]), "body")]).toEqual([]);
    expect([...toggleRelicKind(none, "planar")]).toEqual([
      "planarSphere",
      "linkRope",
    ]);
    expect([
      ...toggleRelicKind(new Set(["planarSphere", "linkRope"]), "planar"),
    ]).toEqual([]);
    expect(
      toggleRelicKind(new Set(["planarSphere", "linkRope"]), "cavern").size
    ).toBe(0);
  });

  it("renders the 4 + 2 chip row with kind toggles", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<Set<RelicSlotId>>(new Set());
      return (
        <I18nProvider>
          <output data-testid="slots">{[...value].join(",")}</output>
          <RelicSlotChips
            value={value}
            onChange={setValue}
            slotLabel={(slot) => slot}
            counts={{ head: 3 }}
          />
        </I18nProvider>
      );
    }
    render(<Harness />);
    expect(screen.getByRole("button", { name: "head 3" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.click(screen.getByRole("button", { name: "Planar Ornaments" }));
    expect(screen.getByTestId("slots")).toHaveTextContent(
      "planarSphere,linkRope"
    );
    expect(screen.getByRole("button", { name: "head 3" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(
      screen.getByRole("button", { name: "Planar Ornaments" })
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Planar Ornaments" }));
    expect(screen.getByTestId("slots")).toBeEmptyDOMElement();
  });
});
