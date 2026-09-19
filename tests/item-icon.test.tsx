import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItemIcon, type ItemIconSize } from "@/components/shared/ItemIcon";

describe("ItemIcon", () => {
  it.each([
    ["character", 7 / 8],
    ["light-cone", 11 / 16],
    ["relic-piece", 1],
    ["relic-set", 1],
  ] as const)("preserves %s card proportions at every size, including the level strip", (kind, ratio) => {
    for (const size of [
      "xs",
      "sm",
      "md",
      "lg",
      "xl",
    ] satisfies ItemIconSize[]) {
      const { container, unmount } = render(
        <ItemIcon
          kind={kind}
          id="test"
          alt="Item"
          rarity={5}
          size={size}
          level="Lv. 80"
          badge={2}
          locked
        />
      );
      const icon = container.querySelector<HTMLElement>(
        "[data-item-icon-kind]"
      )!;
      const artwork = container.querySelector<HTMLElement>(
        "[data-item-artwork]"
      )!;
      const width = Number.parseFloat(artwork.style.width);
      const height = Number.parseFloat(artwork.style.height);
      expect(width / height).toBeCloseTo(ratio);
      expect(Number.parseFloat(icon.style.width)).toBe(width);
      expect(Number.parseFloat(icon.style.height)).toBeGreaterThan(height);
      expect(artwork.querySelector("[data-item-badge]")).not.toBeNull();
      expect(artwork.querySelector("[data-item-lock]")).not.toBeNull();
      unmount();
    }
  });

  it.each([
    [5, "linear-gradient(180deg, #a35d55, #d0aa6e)"],
    [4, "linear-gradient(180deg, #3f4064, #9c65d7)"],
    [3, "linear-gradient(180deg, #3a3b62, #4c86c9)"],
    [2, "linear-gradient(180deg, #374760, #44908c)"],
    [1, "linear-gradient(180deg, #3e404e, #88888e)"],
  ])("uses the HoYoWiki %s-star background", (rarity, backgroundImage) => {
    const { container } = render(
      <ItemIcon
        kind="relic-set"
        id={`rarity-${rarity}`}
        alt={`${rarity}-star item`}
        rarity={rarity}
      />
    );

    expect(container.querySelector("[data-item-artwork]")).toHaveStyle({
      backgroundImage,
    });
  });

  it("composes rarity, rank, level, and lock state into one portrait", () => {
    const { container } = render(
      <ItemIcon
        kind="light-cone"
        id="23005"
        sourcePath="icon/light-cone/23005.png"
        alt="In the Night, 5-star, Level 80, Superimposition 3, Locked"
        rarity={5}
        badge={3}
        level="Lv. 80"
        locked
      />
    );

    const icon = screen.getByRole("img", {
      name: "In the Night, 5-star, Level 80, Superimposition 3, Locked",
    });
    expect(icon).toHaveAttribute("data-item-icon-kind", "light-cone");
    expect(icon).toHaveAttribute("data-item-rarity", "5");
    expect(icon).toHaveAttribute("data-item-level", "Lv. 80");
    expect(container.querySelector("[data-item-badge='3']")).toHaveTextContent(
      "3"
    );
    expect(container.querySelector("[data-item-lock='locked']")).toBeVisible();
    expect(screen.getByText("Lv. 80")).toBeVisible();
  });

  it("shows an icon-only unknown-lock marker without inventing an unlocked state", () => {
    const { container } = render(
      <ItemIcon
        kind="light-cone"
        id="unknown-lock"
        alt="Light Cone, lock state unknown"
        rarity={4}
        locked={null}
      />
    );

    expect(container.querySelector("[data-item-lock='unknown']")).toBeVisible();
    expect(container.querySelector("[data-item-lock='locked']")).toBeNull();
  });

  it("uses a neutral frame when rarity metadata is unavailable", () => {
    const { container } = render(
      <ItemIcon
        kind="relic-set"
        id="unknown-rarity"
        alt="Relic set"
        rarity={null}
      />
    );

    expect(screen.getByRole("img", { name: "Relic set" })).toHaveAttribute(
      "data-item-rarity",
      "unknown"
    );
    expect(container.querySelector("[data-item-artwork]")).toHaveStyle({
      backgroundImage:
        "linear-gradient(180deg, hsl(var(--muted)), hsl(var(--secondary)))",
    });
  });
});
