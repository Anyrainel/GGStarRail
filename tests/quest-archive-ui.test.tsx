import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { loadQuestArchive } from "@/data/questLoader";
import { I18nProvider } from "@/i18n/I18nContext";
import { QuestArchiveContent } from "@/pages/archive/QuestArchiveView";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { makeAccountSnapshot } from "./fixtures";

afterEach(() => useWorkspaceStore.getState().clearWorkspace());

it("preserves unknown objectives, separates deleted records and searches across filters", async () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === "(min-width: 768px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  const catalog = await loadQuestArchive();
  const quests = catalog.quests.filter((quest) =>
    [1001711, 1001712, 2100003].includes(quest.id)
  );
  const account = makeAccountSnapshot();
  account.questProgress = {
    importedAt: account.source.importedAt,
    records: [
      { id: 1001711, status: 3, progress: 1, counters: [] },
      { id: 1001712, status: 4, progress: 0, counters: [] },
      { id: 2100003, status: 3, progress: 1, counters: [] },
      { id: 4999999, status: 1, progress: 7, counters: [2] },
    ],
  };
  useWorkspaceStore.setState({ account });
  render(
    <I18nProvider>
      <QuestArchiveContent
        quests={quests}
        achievementIds={catalog.achievementIds}
      />
    </I18nProvider>
  );
  const user = userEvent.setup();
  expect(
    screen.getByRole("heading", { name: "Objective #4999999" })
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Removed" }));
  expect(screen.getByText("#1001712")).toBeVisible();
  expect(screen.queryByText("#2100003")).not.toBeInTheDocument();
  expect(screen.queryByText("#4999999")).not.toBeInTheDocument();
  await user.type(screen.getByRole("searchbox"), "4999999");
  expect(screen.getByText("#4999999")).toBeVisible();
  expect(screen.queryByText("#1001712")).not.toBeInTheDocument();
});
