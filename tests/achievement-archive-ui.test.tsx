import { render, screen, waitFor, within } from "@testing-library/react";
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
  useWorkspaceStore.getState().clearWorkspace();
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
    expect(screen.queryByText("Complete achievement capture")).toBeNull();
  });

  it("tracks completion without an imported account or account banner", async () => {
    const user = userEvent.setup();
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: null });
    renderArchive();

    expect(await screen.findByText("First Footstep")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0"
    );
    expect(screen.getByRole("button", { name: "Unfinished" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Finished" })).toBeEnabled();
    expect(screen.queryByText(/Import an account/)).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Mark First Footstep finished" })
    );
    expect(useWorkspaceStore.getState().account).toBeNull();
    expect(
      useWorkspaceStore.getState().localAchievementCompletion.completedIds
    ).toEqual([101]);
    expect(screen.getByText("50%")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Mark First Footstep unfinished" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("offers explicit local tracking for an account without coverage", async () => {
    const user = userEvent.setup();
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: makeAccountSnapshot() });
    renderArchive();

    const startButton = await screen.findByRole("button", {
      name: "Mark First Footstep finished",
    });
    expect(startButton).toBeEnabled();
    expect(startButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Unfinished" })).toBeEnabled();

    await user.click(startButton);

    await waitFor(() => {
      expect(
        useWorkspaceStore.getState().account?.achievementCompletion
          ?.completedIds
      ).toEqual([101]);
    });
    expect(screen.getByRole("button", { name: "Unfinished" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Mark First Footstep unfinished" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("50%")).toBeVisible();
  });

  it("preserves captured progress without showing a coverage banner", async () => {
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

    expect(await screen.findByText("50%")).toBeVisible();
    expect(
      screen.queryByText("Captured completion, edited locally")
    ).toBeNull();
  });
});

describe("AchievementArchiveContent visibility and filtering", () => {
  it("shows release badges and major-version chips with newest releases first inside in-game category order", async () => {
    const user = userEvent.setup();
    setDesktopLayout(true);
    const item = (
      id: number,
      name: string,
      releaseVersion: string | null,
      order: number
    ): AchievementArchiveItemView => ({
      ...ACHIEVEMENTS[0]!,
      id,
      name,
      releaseVersion,
      order,
      chainIds: [id],
      chainIndex: 0,
    });
    render(
      <I18nProvider>
        <AchievementArchiveContent
          categories={[...CATEGORIES].reverse()}
          achievements={[
            {
              ...item(301, "Older chain member", "1.0", 999),
              chainIds: [301, 303],
            },
            item(302, "Middle patch", "4.2", 500),
            {
              ...item(303, "Newest chain member", "4.10.1", 1),
              chainIds: [301, 303],
              chainIndex: 1,
            },
            item(304, "High-priority same patch", "4.10.1", 8),
            item(305, "Unknown release", null, 9999),
            { ...ACHIEVEMENTS[2]!, releaseVersion: "10.0" },
          ]}
        />
      </I18nProvider>
    );

    await screen.findByRole("article", { name: "Newest chain member" });
    const categories = within(
      screen.getByRole("complementary", { name: "Achievement category list" })
    ).getAllByRole("button");
    expect(categories[0]).toHaveTextContent("The Rail Unto the Stars");
    expect(categories[1]).toHaveTextContent("Fathom the Unfathomable");
    expect(
      screen
        .getAllByRole("article")
        .map((row) => row.getAttribute("aria-label"))
    ).toEqual([
      "High-priority same patch",
      "Newest chain member",
      "Middle patch",
      "Older chain member",
      "Unknown release",
    ]);
    expect(
      within(
        screen.getByRole("article", { name: "Newest chain member" })
      ).getByText("v4.10.1")
    ).toBeVisible();
    for (const version of ["v1.x", "v4.x", "v10.x"])
      expect(screen.getByRole("button", { name: version })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "v4.x" }));
    expect(
      screen
        .getAllByRole("article")
        .map((row) => row.getAttribute("aria-label"))
    ).toEqual([
      "High-priority same patch",
      "Newest chain member",
      "Middle patch",
    ]);
    await user.click(
      screen.getByRole("button", { name: "Mark Newest chain member finished" })
    );
    expect(
      useWorkspaceStore.getState().localAchievementCompletion.completedIds
    ).toEqual([301, 303]);
  });

  it("omits unknown-version clutter and internal IDs", async () => {
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: accountWithKnownCompletion([]) });
    render(
      <I18nProvider>
        <AchievementArchiveContent
          categories={CATEGORIES}
          achievements={ACHIEVEMENTS.map((achievement) => ({
            ...achievement,
            releaseVersion: null,
          }))}
        />
      </I18nProvider>
    );
    const concealed = await screen.findByRole("article", {
      name: "A Secret Terminus",
    });
    expect(concealed).not.toHaveTextContent("102");
    expect(
      screen.getByRole("button", { name: "Mark A Secret Terminus finished" })
    ).toHaveAttribute("title", "Mark A Secret Terminus finished");
    expect(screen.queryByText("Version unknown")).not.toBeInTheDocument();
  });

  it("shows real names, descriptions, and video image links for every hidden mode", async () => {
    const user = userEvent.setup();
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: accountWithKnownCompletion([]) });
    renderArchive();

    expect(await screen.findByText("A Secret Terminus")).toBeVisible();
    expect(
      screen.getByRole("article", { name: "A Secret Terminus" })
    ).toBeVisible();
    expect(screen.getByText("Witness the final departure.")).toBeVisible();
    const youtube = screen.getByRole("link", {
      name: /YouTube.*A Secret Terminus|A Secret Terminus.*YouTube/,
    });
    expect(youtube.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/brands/youtube.webp"
    );
    expect(youtube).toHaveAttribute(
      "href",
      expect.stringContaining("A%20Secret%20Terminus%20Honkai")
    );
    const bilibili = screen.getByRole("link", {
      name: /Bilibili.*A Secret Terminus|A Secret Terminus.*Bilibili/,
    });
    expect(bilibili.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/brands/bilibili.webp"
    );
    expect(
      screen.queryByText("This must never be shown before completion.")
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /Fathom the Unfathomable/ })
    );
    expect(await screen.findByText("Clockwork Dream")).toBeVisible();
    expect(screen.queryByText("Follow the silver clock's hint.")).toBeNull();
    expect(screen.getByText("Find the real scarlet answer.")).toBeVisible();
  });

  it("searches real hidden achievement text and excludes category names", async () => {
    const user = userEvent.setup();
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: accountWithKnownCompletion([]) });
    renderArchive();
    const search = screen.getByRole("searchbox", {
      name: "Search achievements",
    });

    await user.type(search, "secret terminus");
    expect(await screen.findByText("A Secret Terminus")).toBeVisible();

    await user.clear(search);
    await user.type(search, "scarlet clock");
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
    await user.type(search, "  SCARLET   clock ");
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

    expect(await screen.findByText("A Secret Terminus")).toBeVisible();
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
    expect(screen.queryByText("A Secret Terminus")).toBeNull();
  });

  it("passes the full hidden chain to the completion cascade", async () => {
    const user = userEvent.setup();
    setDesktopLayout(true);
    useWorkspaceStore.setState({ account: accountWithKnownCompletion([]) });
    renderArchive();

    await user.click(
      await screen.findByRole("button", {
        name: "Mark A Secret Terminus finished",
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
    expect(screen.getByRole("button", { name: "v3.x" })).toBeVisible();
    expect(
      within(screen.getByRole("article", { name: "First Footstep" })).getByText(
        "v3.4"
      )
    ).toBeVisible();
  });
});
