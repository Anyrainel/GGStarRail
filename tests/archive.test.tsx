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
  await user.click(
    screen.getByLabelText(/^(More|更多)$/, { selector: "button" })
  );
  await user.click(
    await screen.findByRole("menuitemradio", {
      name: chinese ? "简体中文" : "English",
    })
  );
}

async function selectSkillLevel(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  level: number
) {
  await user.click(trigger);
  const listbox = document.getElementById(
    trigger.getAttribute("aria-controls") ?? ""
  );
  if (!listbox) throw new Error("The skill level listbox was not opened");
  expect(listbox).toHaveAttribute("role", "listbox");
  await user.click(
    within(listbox).getByRole("option", { name: `Level ${level}` })
  );
}

describe("Character archive", () => {
  beforeEach(() => {
    setBetaEnabled(true);
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query === "(min-width: 768px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

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
    const rows = () => region.querySelectorAll("button[data-character-id]");
    const allCount = rows().length;
    const iceChip = screen.getByRole("button", { name: "Ice" });
    await user.click(iceChip);
    expect(rows().length).toBeLessThan(allCount);
    const search = screen.getByLabelText("Search", { selector: "input" });
    await user.click(search);
    await user.paste("三月七");
    expect(iceChip).toBeDisabled();
    expect(rows()).toHaveLength(2);
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
    await user.paste("Trailblazer");
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
    // This route exercises the real bilingual catalogs, including all mode data.
    // Allow its async load and locale rerender to share CPU with the full suite.
  }, 15_000);

  it("keeps the shared description choice while changing characters and compares two skill levels", async () => {
    const user = userEvent.setup();
    renderArchive(`${APP_PATHS.archiveCharacters}?id=1001`);
    const region = await catalogRegion();
    const detail = screen.getByTestId("character-detail");
    const descriptions = within(detail).getByRole("group", {
      name: "Description",
    });
    expect(
      within(descriptions).getByRole("button", { name: "Full" })
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(
      within(descriptions).getByRole("button", { name: "Brief" })
    );
    const skills = within(detail).getByTestId("character-base-skills");
    expect(skills).toHaveAttribute("open");
    const table = within(skills).getAllByRole("table", {
      name: "Skill values",
    })[0];
    const [left, right] = within(table).getAllByRole("combobox");
    await selectSkillLevel(user, left, 2);
    expect(left).toHaveTextContent("Level 2");
    await selectSkillLevel(user, right, 1);
    expect(right).toHaveTextContent("Level 1");
    const traces = within(detail).getByTestId("character-traces");
    expect(
      within(traces).getByRole("table", { name: "Trace stat bonuses" })
    ).toBeInTheDocument();
    expect(traces).not.toHaveTextContent("DEF Boost");
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
      within(aglaea).getByRole("button", { name: "Brief" })
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
  }, 15_000);

  it("opens inline character details on narrow screens and returns to the roster", async () => {
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
    expect(await screen.findByTestId("character-detail")).toHaveTextContent(
      "March 7th"
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Character catalog results" })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Characters" }));
    expect(characterRow(await catalogRegion(), "1001")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByTestId("character-detail")).not.toBeInTheDocument();
  });
});
