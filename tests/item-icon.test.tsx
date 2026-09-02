import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItemIcon } from "@/components/shared/ItemIcon";

describe("ItemIcon", () => {
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
});
