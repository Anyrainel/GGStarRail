import { describe, expect, it, vi } from "vitest";
import {
  filterArchiveItems,
  isArchiveSearchActive,
  itemMatchesArchiveFilterScope,
} from "@/lib/archiveFilters";

describe("archive filter scope", () => {
  it("treats only non-whitespace input as active search", () => {
    expect(isArchiveSearchActive(" \t ")).toBe(false);
    expect(isArchiveSearchActive("  stellar jade  ")).toBe(true);
  });

  it("normalizes active search and bypasses chip filters", () => {
    const item = { name: "The Express Crew" };
    const matchesSearch = vi.fn((candidate: typeof item, query: string) =>
      candidate.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    );
    const matchesChipFilters = vi.fn(() => false);

    expect(
      itemMatchesArchiveFilterScope(
        item,
        "  express crew  ",
        matchesSearch,
        matchesChipFilters
      )
    ).toBe(true);
    expect(matchesSearch).toHaveBeenCalledWith(item, "express crew");
    expect(matchesChipFilters).not.toHaveBeenCalled();
  });

  it("uses chip filters for empty and whitespace-only searches", () => {
    const item = { id: "achievement:1" };
    const matchesSearch = vi.fn(() => false);
    const matchesChipFilters = vi.fn(() => true);

    expect(
      itemMatchesArchiveFilterScope(
        item,
        "   ",
        matchesSearch,
        matchesChipFilters
      )
    ).toBe(true);
    expect(matchesSearch).not.toHaveBeenCalled();
    expect(matchesChipFilters).toHaveBeenCalledWith(item);
  });

  it("applies the selected scope to a collection", () => {
    const items = ["stellar jade", "lost jade", "credits"];

    expect(
      filterArchiveItems(
        items,
        "  lost  ",
        (item, query) => item.includes(query),
        (item) => item.startsWith("stellar")
      )
    ).toEqual(["lost jade"]);
    expect(
      filterArchiveItems(
        items,
        " \t ",
        (item, query) => item.includes(query),
        (item) => item.startsWith("stellar")
      )
    ).toEqual(["stellar jade"]);
  });
});
