import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/config/identity";
import { I18nProvider } from "@/i18n/I18nContext";
import {
  type AchievementArchiveCategoryView,
  AchievementArchiveContent,
  type AchievementArchiveItemView,
} from "@/pages/archive/AchievementArchiveContent";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { makeAccountSnapshot } from "./fixtures";

const CATEGORIES: readonly AchievementArchiveCategoryView[] = [
  { id: 1, name: "The Rail Unto the Stars", order: 90 },
  { id: 2, name: "Fathom the Unfathomable", order: 80 },
];

const ACHIEVEMENTS: readonly AchievementArchiveItemView[] = [
  {
    id: 101,
    categoryId: 1,
    name: "First Footstep",
    description: "Board the Astral Express.",
    hiddenDescription: null,
    order: 100,
    releaseVersion: "3.4",
    visibility: "visible",
    chainIds: [101, 102],
    chainIndex: 0,
    rewardCount: 5,
    rewardItemId: 1,
  },
  {
    id: 102,
    categoryId: 1,
    name: "A Secret Terminus",
    description: "Witness the final departure.",
    hiddenDescription: "This must never be shown before completion.",
    order: 110,
    releaseVersion: null,
    visibility: "show_after_finish",
    chainIds: [101, 102],
    chainIndex: 1,
    rewardCount: 10,
    rewardItemId: 1,
  },
  {
    id: 201,
    categoryId: 2,
    name: "Clockwork Dream",
    description: "Find the real scarlet answer.",
    hiddenDescription: "Follow the silver clock's hint.",
    order: 90,
    releaseVersion: "4.1",
    visibility: "hidden_description",
    chainIds: [201],
    chainIndex: 0,
    rewardCount: 20,
    rewardItemId: 1,
  },
];

function setDesktopLayout(desktop: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: desktop && query === "(min-width: 768px)",
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

function renderArchive() {
  return render(
    <I18nProvider>
      <AchievementArchiveContent
        categories={CATEGORIES}
        achievements={ACHIEVEMENTS}
      />
    </I18nProvider>
  );
}

function accountWithKnownCompletion(completedIds: readonly number[]) {
  return {
    ...makeAccountSnapshot(),
    achievementCompletion: {
      completedIds: [...completedIds],
      capture: {
        coverage: "complete" as const,
        source: {
          kind: "packetCapture" as const,
          revision: "capture-fixture",
        },
        importedAt: "2026-09-04T00:00:00.000Z",
      },
    },
  };
}

afterEach(() => {
  useWorkspaceStore.setState({ account: null });
});

describe("AchievementArchiveContent completion coverage", () => {
  it("treats captured empty completion as known zero with live progress", async () => {
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: accountWithKnownCompletion([]) });
    renderArchive();

    expect(await screen.findByText("First Footstep")).toBeVisible();
    expect(
      screen.getByRole("progressbar", {
        name: "The Rail Unto the Stars: 0 of 2 completed",
      })
    ).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0%")).toBeVisible();
    expect(screen.getByText("Complete achievement capture")).toBeVisible();
  });

  it("never claims zero or unfinished when completion is unavailable", async () => {
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: null });
    renderArchive();

    expect(await screen.findByText("First Footstep")).toBeVisible();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("0%")).toBeNull();
    expect(
      screen.getAllByText("Completion is unavailable for this account source")
        .length
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Unfinished" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Finished" })).toBeDisabled();
    for (const button of screen.getAllByRole("button", {
      name: "Import an account before tracking achievement completion.",
    })) {
      expect(button).toBeDisabled();
    }
  });

  it("offers explicit local tracking for an account without coverage", async () => {
    const user = userEvent.setup();
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: makeAccountSnapshot() });
    renderArchive();

    const startButton = await screen.findByRole("button", {
      name: "Start local tracking and mark First Footstep finished",
    });
    expect(startButton).toBeEnabled();
    expect(startButton).not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("button", { name: "Unfinished" })).toBeDisabled();

    await user.click(startButton);

    await waitFor(() => {
      expect(
        useWorkspaceStore.getState().account?.achievementCompletion
          ?.completedIds
      ).toEqual([101]);
    });
    expect(screen.getByText("Tracked locally")).toBeVisible();
    expect(screen.getByRole("button", { name: "Unfinished" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Mark First Footstep unfinished" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("50%")).toBeVisible();
  });

  it("distinguishes a captured set that was edited locally", async () => {
    setDesktopLayout(true);
    const account = accountWithKnownCompletion([101]);
    useWorkspaceStore.setState({
      account: {
        ...account,
        achievementCompletion: {
          ...account.achievementCompletion,
          locallyModifiedAt: "2026-09-04T01:00:00.000Z",
        },
      },
    });
    renderArchive();

    expect(
      await screen.findByText("Captured completion, edited locally")
    ).toBeVisible();
  });
});

describe("AchievementArchiveContent visibility and filtering", () => {
  it("conceals ShowAfterFinish and shows only the alternate HiddenDesc text", async () => {
    const user = userEvent.setup();
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: accountWithKnownCompletion([]) });
    renderArchive();

    expect(await screen.findByText("Hidden achievement")).toBeVisible();
    expect(
      screen.getByRole("article", { name: "Hidden achievement 102" })
    ).toBeVisible();
    expect(screen.queryByText("A Secret Terminus")).toBeNull();
    expect(screen.queryByText("Witness the final departure.")).toBeNull();
    expect(
      screen.queryByText("This must never be shown before completion.")
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /Fathom the Unfathomable/ })
    );
    expect(await screen.findByText("Clockwork Dream")).toBeVisible();
    expect(screen.getByText("Follow the silver clock's hint.")).toBeVisible();
    expect(screen.queryByText("Find the real scarlet answer.")).toBeNull();
  });

  it("searches only displayed item text and never category or concealed text", async () => {
    const user = userEvent.setup();
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: accountWithKnownCompletion([]) });
    renderArchive();
    const search = screen.getByRole("searchbox", {
      name: "Search achievements",
    });

    await user.type(search, "secret terminus");
    expect(
      await screen.findByText("No achievements match these filters.")
    ).toBeVisible();

    await user.clear(search);
    await user.type(search, "silver clock");
    expect(
      await screen.findByRole("button", { name: /Fathom the Unfathomable/ })
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /Rail Unto/ })).toBeNull();

    await user.clear(search);
    await user.type(search, "The Rail Unto the Stars");
    expect(
      await screen.findByText("No achievements match these filters.")
    ).toBeVisible();
  });

  it("lets whitespace-token AND search override saved version chips and restores them", async () => {
    const user = userEvent.setup();
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: accountWithKnownCompletion([]) });
    renderArchive();

    await screen.findByText("First Footstep");
    await user.click(screen.getByRole("button", { name: "v3.x" }));
    expect(
      screen.queryByRole("button", { name: /Fathom the Unfathomable/ })
    ).toBeNull();

    const search = screen.getByRole("searchbox", {
      name: "Search achievements",
    });
    await user.type(search, "  SILVER   clock ");
    expect(screen.getByRole("button", { name: "v3.x" })).toBeDisabled();
    expect(
      await screen.findByRole("button", { name: /Fathom the Unfathomable/ })
    ).toBeVisible();

    await user.clear(search);
    expect(screen.getByRole("button", { name: "v3.x" })).toBeEnabled();
    expect(
      await screen.findByRole("button", { name: /The Rail Unto the Stars/ })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Fathom the Unfathomable/ })
    ).toBeNull();
  });

  it("filters unknown release versions as their own honest item-level bucket", async () => {
    const user = userEvent.setup();
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: accountWithKnownCompletion([]) });
    renderArchive();

    await screen.findByText("First Footstep");
    await user.click(screen.getByRole("button", { name: "Version unknown" }));

    expect(await screen.findByText("Hidden achievement")).toBeVisible();
    expect(screen.queryByText("First Footstep")).toBeNull();
  });

  it("keeps a toggled row visible until a filter boundary refresh", async () => {
    const user = userEvent.setup();
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: accountWithKnownCompletion([]) });
    renderArchive();

    const toggle = await screen.findByRole("button", {
      name: "Mark First Footstep finished",
    });
    await user.click(toggle);
    expect(screen.getByText("First Footstep")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Finished" }));
    await user.click(screen.getByRole("button", { name: "Unfinished" }));
    expect(screen.getByText("First Footstep")).toBeVisible();
    expect(screen.queryByText("Hidden achievement")).toBeNull();
  });

  it("passes the full hidden chain to the completion cascade", async () => {
    const user = userEvent.setup();
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: accountWithKnownCompletion([]) });
    renderArchive();

    await user.click(
      await screen.findByRole("button", {
        name: "Mark Hidden achievement 102 finished",
      })
    );
    await waitFor(() => {
      expect(
        useWorkspaceStore.getState().account?.achievementCompletion
          ?.completedIds
      ).toEqual([101, 102]);
    });
    expect(await screen.findByText("A Secret Terminus")).toBeVisible();
    expect(screen.getByText("Witness the final departure.")).toBeVisible();
  });
});

describe("AchievementArchiveContent at 390px", () => {
  it("uses browse, detail, and back IA without a horizontal scroll surface", async () => {
    const user = userEvent.setup();
    setDesktopLayout(false);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    useWorkspaceStore.setState({ account: accountWithKnownCompletion([]) });
    const { container } = renderArchive();

    expect(
      container.querySelector('[data-sidebar-detail-layout="mobile-browse"]')
    ).toBeInTheDocument();
    expect(screen.queryByText("First Footstep")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /The Rail Unto the Stars/ })
    );
    expect(
      container.querySelector('[data-sidebar-detail-layout="mobile-detail"]')
    ).toBeInTheDocument();
    expect(await screen.findByText("First Footstep")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Achievement categories" })
    ).toBeVisible();
    expect(container.querySelector("article")).toHaveClass("min-w-0");
    expect(container.querySelector('[class*="overflow-x-auto"]')).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Achievement categories" })
    );
    expect(
      container.querySelector('[data-sidebar-detail-layout="mobile-browse"]')
    ).toBeInTheDocument();
    expect(screen.queryByText("First Footstep")).toBeNull();
  });

  it("renders the same narrow information architecture in zh-CN", async () => {
    const user = userEvent.setup();
    setDesktopLayout(false);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    localStorage.setItem(STORAGE_KEYS.locale, "zh-CN");
    useWorkspaceStore.setState({ account: accountWithKnownCompletion([]) });
    renderArchive();

    await user.click(
      screen.getByRole("button", { name: /The Rail Unto the Stars/ })
    );
    expect(screen.getByRole("button", { name: "成就分类" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "搜索成就" })).toBeVisible();
    expect(screen.getByRole("group", { name: "成就筛选" })).toBeVisible();
  });
});
