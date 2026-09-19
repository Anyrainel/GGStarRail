import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { APP_PATHS } from "@/config/navigation";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { setBetaEnabled } from "@/data/betaState";
import { I18nProvider } from "@/i18n/I18nContext";

function renderArchive(path: string = APP_PATHS.archiveCharacters) {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

async function catalogRegion() {
  return screen.findByRole(
    "region",
    { name: "Character catalog results" },
    { timeout: 15_000 }
  );
}

function queryElement(container: HTMLElement, selector: string) {
  const element = container.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`${selector} was not rendered`);
  return element;
}

function characterRow(region: HTMLElement, id: string) {
  return queryElement(region, `[data-character-id="${id}"]`);
}

async function switchLocale(
  user: ReturnType<typeof userEvent.setup>,
  chinese: boolean
) {
  await user.click(screen.getByRole("button", { name: /^(More|更多)$/ }));
  await user.click(
    await screen.findByRole("menuitemradio", {
      name: chinese ? "简体中文" : "English",
    })
  );
}

describe("Character archive", () => {
  beforeEach(() => setBetaEnabled(true));

  it("preserves incoming deep links through async loading and places Currency War last", async () => {
    const user = userEvent.setup();
    renderArchive(`${APP_PATHS.archiveCharacters}?id=1004`);
    const region = await catalogRegion();
    await waitFor(() =>
      expect(
        within(screen.getByTestId("character-detail")).getByRole("heading", {
          name: "Welt",
          level: 2,
        })
      ).toBeInTheDocument()
    );
    expect(characterRow(region, "1004")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const detail = screen.getByTestId("character-detail");
    const mode = within(detail).getByTestId("character-currency-war");
    expect(
      within(mode).queryByRole("button", { name: "Off-Field" })
    ).not.toBeInTheDocument();
    expect(detail.querySelectorAll("details details")).toHaveLength(0);
    expect([...detail.querySelectorAll("details")].at(-1)).toBe(mode);
    for (const section of detail.querySelectorAll("details"))
      expect(section).toHaveAttribute("open");
    expect(detail).not.toHaveTextContent(
      /AvatarSkillConfig|AvatarServantSkillConfig|BPSkill|Item-name provenance|Progression|Character EXP|Enhanced ID|TextMap\/|GIlore/
    );
    await user.click(characterRow(region, "1409"));
    const hyacineMode = screen.getByTestId("character-currency-war");
    expect(
      within(hyacineMode).getByRole("button", { name: "On-Field" })
    ).toBeInTheDocument();
    expect(
      within(hyacineMode).getByRole("heading", { name: "Memosprites (2)" })
    ).toBeInTheDocument();
  });

  it("searches both languages, bypasses chips during search and restores their scope afterwards", async () => {
    const user = userEvent.setup();
    renderArchive();
    const region = await catalogRegion();
    const allCount = within(region).getAllByRole("button").length;
    const iceChip = screen.getByRole("button", { name: "Ice" });
    await user.click(iceChip);
    expect(within(region).getAllByRole("button").length).toBeLessThan(allCount);
    const search = screen.getByRole("searchbox", { name: "Search" });
    await user.type(search, "三月七");
    expect(iceChip).toBeDisabled();
    expect(within(region).getAllByRole("button")).toHaveLength(2);
    const huntMarch = characterRow(region, "1224");
    expect(huntMarch).toHaveTextContent("The Hunt");
    expect(huntMarch).toHaveTextContent("Imaginary");
    expect(huntMarch).not.toHaveTextContent("1224");
    await user.click(huntMarch);
    expect(
      within(screen.getByTestId("character-detail")).getByText("The Hunt")
    ).toBeInTheDocument();
    await user.clear(search);
    expect(characterRow(region, "1001")).toBeInTheDocument();
    expect(
      region.querySelector('[data-character-id="1224"]')
    ).not.toBeInTheDocument();
    expect(iceChip).not.toBeDisabled();
    await user.type(search, "Trailblazer");
    expect(characterRow(region, "8001")).toHaveTextContent(
      "Trailblazer · Caelus"
    );
    await user.click(characterRow(region, "8001"));
    expect(screen.getByTestId("character-detail")).not.toHaveTextContent(
      /\{NICKNAME\}|\{F#|\{M#/
    );
    await switchLocale(user, true);
    expect(characterRow(region, "8001")).toHaveTextContent("开拓者");
    expect(screen.getByTestId("character-detail")).not.toHaveTextContent(
      "{NICKNAME}"
    );
  });

  it("keeps the shared description choice while changing characters and compares two skill levels", async () => {
    const user = userEvent.setup();
    renderArchive(`${APP_PATHS.archiveCharacters}?id=1001`);
    const region = await catalogRegion();
    const detail = screen.getByTestId("character-detail");
    expect(
      within(detail).getByRole("button", { name: "Brief" })
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(within(detail).getByRole("button", { name: "Full" }));
    const skills = within(detail).getByTestId("character-base-skills");
    expect(skills).toHaveAttribute("open");
    const table = within(skills).getAllByRole("table", {
      name: "Skill values",
    })[0];
    const [left, right] = within(table).getAllByRole("combobox");
    const leftOptions = within(left).getAllByRole("option");
    expect(leftOptions.length).toBeGreaterThan(1);
    await user.selectOptions(left, leftOptions[1]);
    expect(left).toHaveValue(leftOptions[1].getAttribute("value"));
    await user.selectOptions(right, leftOptions[0].getAttribute("value")!);
    expect(right).toHaveValue(leftOptions[0].getAttribute("value"));
    const firstEidolon = queryElement(
      within(detail).getByTestId("character-eidolons"),
      '[data-rank-id="100101"]'
    );
    expect(firstEidolon).toHaveTextContent("Memory of You");
    expect(firstEidolon).toHaveTextContent("6 Energy");
    expect(firstEidolon.querySelector("summary")).toBeNull();
    expect(firstEidolon).not.toHaveTextContent(/Unlock|Parameters|11001/);
    await user.click(characterRow(region, "1402"));
    const aglaea = screen.getByTestId("character-detail");
    expect(
      within(aglaea).getByRole("button", { name: "Full" })
    ).toHaveAttribute("aria-pressed", "true");
    const servant = within(aglaea).getByTestId("character-servants");
    expect(servant).toHaveTextContent("Garmentmaker");
    expect(servant).toHaveTextContent("Thorned Snare");
    expect(servant).not.toHaveTextContent(/11402|AvatarServantSkillConfig/);
    expect(servant.querySelector("details")).toBeNull();
    await user.click(characterRow(region, "1004"));
    expect(screen.getByTestId("character-enhancements")).toHaveAttribute(
      "open"
    );
  });

  it("opens the narrow-screen detail sheet and restores focus to the selected roster row", async () => {
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query === "(max-width: 1023px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    renderArchive();
    const region = await catalogRegion();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const row = characterRow(region, "1001");
    await user.click(row);
    const dialog = await screen.findByRole("dialog", { name: "March 7th" });
    expect(within(dialog).getByTestId("character-detail")).toHaveTextContent(
      "March 7th"
    );
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(row).toHaveFocus();
  });
});
