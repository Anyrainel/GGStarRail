import { describe, expect, it } from "vitest";
import { formatCatalogValue, formatGameText } from "@/lib/gameText";

describe("GIlore display text", () => {
  it("renders parameters while removing game markup and preserving lines", () => {
    expect(
      formatGameText(
        "Deals <color=#fff><unbreak>#1[i]%</unbreak></color> damage.\\nSecond line.",
        [0.125]
      )
    ).toBe("Deals 12.5% damage.\nSecond line.");
  });

  it("leaves an unresolved source placeholder visible", () => {
    expect(formatGameText("Value #2[i]%", [0.1])).toBe("Value #2[i]%");
  });

  it("renders both Trailblazer gender choices without leaking source tokens", () => {
    const source =
      "A {F#girl}{M#boy}. {F#She}{M#He} can rely on {F#herself}{M#himself}.";

    expect(formatGameText(source)).toBe(
      "A girl/boy. She/He can rely on herself/himself."
    );
    expect(source).toContain("{F#girl}{M#boy}");
  });

  it("unwraps an unpaired gender choice token instead of exposing markup", () => {
    expect(formatGameText("The hero is {F#herself}.")).toBe(
      "The hero is herself."
    );
  });

  it("removes ruby annotations and entity-escaped game tags", () => {
    expect(
      formatGameText(
        "The {RUBY_B#Reason Titan}Cerces{RUBY_E#} reached &lt;unbreak&gt;999&lt;/unbreak&gt;."
      )
    ).toBe("The Cerces reached 999.");
  });

  it("normalizes nickname tokens in descriptions with the active locale term", () => {
    const source = "Isn't that right, {NICKNAME}?";
    expect(formatGameText(source, [], "Trailblazer")).toBe(
      "Isn't that right, Trailblazer?"
    );
    expect(formatGameText(source, [], "开拓者")).toBe(
      "Isn't that right, 开拓者?"
    );
    expect(source).toContain("{NICKNAME}");
  });

  it("formats ratio and flat catalog values without changing source data", () => {
    expect(formatCatalogValue(0.0648, "ratio")).toBe("6.48%");
    expect(formatCatalogValue(5.1, "flat")).toBe("5.1");
  });
});
