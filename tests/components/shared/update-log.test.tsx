import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WhatsNew } from "@/components/shared/WhatsNew";
import { I18nProvider } from "@/i18n/I18nContext";
import { parseUpdateLog, updateLogs } from "@/services/content/updateLog";

describe("update history", () => {
  it("keeps roadmap, dates and feature/fix bullets separate", () => {
    expect(
      parseUpdateLog(
        "## roadmap\r\n- Next\r\n\r\n## 2026-10-10\r\n### features\r\n- Added\r\n### fixes\r\n- Fixed\r\n## 2026-10-09\r\n### features\r\n- Earlier"
      )
    ).toEqual({
      roadmap: ["Next"],
      entries: [
        {
          date: "2026-10-10",
          sections: [
            { category: "features", items: ["Added"] },
            { category: "fixes", items: ["Fixed"] },
          ],
        },
        {
          date: "2026-10-09",
          sections: [{ category: "features", items: ["Earlier"] }],
        },
      ],
    });
  });

  it("rejects broken bundled copy rather than hiding it", () => {
    expect(() =>
      parseUpdateLog("## 2026-10-10\n### feature\n- Missing")
    ).toThrow();
    expect(() => parseUpdateLog("- Orphan")).toThrow();
  });

  it("opens from the Pac-Man keyboard control and closes with Escape", () => {
    render(
      <I18nProvider>
        <WhatsNew>
          <div data-wn-card>Card</div>
        </WhatsNew>
      </I18nProvider>
    );
    const pacman = screen.getByLabelText("What’s New");
    fireEvent.click(pacman);
    expect(screen.getByRole("dialog", { name: "What’s New" })).toBeVisible();
    for (const entry of updateLogs.en.entries) {
      expect(screen.getByText(entry.date)).toBeVisible();
      for (const section of entry.sections) {
        for (const item of section.items) {
          expect(screen.getByText(item)).toBeVisible();
        }
      }
    }
    expect(screen.queryByText("No updates yet.")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("publishes matching bilingual dates, sections and bullet counts", () => {
    const structure = (history: typeof updateLogs.en) => ({
      roadmapCount: history.roadmap.length,
      entries: history.entries.map((entry) => ({
        date: entry.date,
        sections: entry.sections.map((section) => ({
          category: section.category,
          count: section.items.length,
        })),
      })),
    });
    expect(updateLogs.en.entries.length).toBeGreaterThan(0);
    expect(structure(updateLogs.en)).toEqual(structure(updateLogs["zh-CN"]));
  });
});
