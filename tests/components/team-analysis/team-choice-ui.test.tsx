import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "@/app/App";
import { ChoiceHoverCard } from "@/components/team-analysis/choice/ChoiceHoverCard";
import {
  candidateCount,
  currentBonuses,
  entrySets,
  isCurrentEntry,
  topRowCount,
} from "@/components/team-analysis/choice/choiceModel";
import { APP_PATHS } from "@/config/navigation";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { Relic } from "@/domain/account/schemas";
import { emptyTeam, type TeamPlan } from "@/domain/team/schemas";
import { I18nProvider } from "@/i18n/I18nContext";
import type { CompareEntry } from "@/services/combat/jobs";
import { clearResultCache } from "@/services/combat/resultCache";
import type { MemberPreview } from "@/services/combat/teamPreview";
import { DEFAULT_TEAM_STORE } from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";

/**
 * Set-plan rankings are minutes of work per member; tests may stub them, or
 * hold them on `gate` until it resolves.
 */
const stubbedSetPlans = vi.hoisted(() => ({
  entries: null as unknown,
  gate: null as Promise<void> | null,
  /** Compared slots, in order. */
  slots: [] as number[],
}));

vi.mock("@/services/combat/client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/combat/client")>();
  const runCombatJob: typeof actual.runCombatJob = (job, lane) =>
    job.kind === "compare" &&
    "kind" in job.request &&
    job.request.kind === "setPlans" &&
    stubbedSetPlans.entries
      ? (stubbedSetPlans.gate ?? Promise.resolve()).then(() => {
          if ("slot" in job.request)
            stubbedSetPlans.slots.push(job.request.slot);
          return stubbedSetPlans.entries as never;
        })
      : actual.runCombatJob(job, lane);
  return { ...actual, runCombatJob };
});

function renderChoice(teamId: string) {
  return render(
    <ThemeProvider>
      <I18nProvider>
        <MemoryRouter
          initialEntries={[
            `${APP_PATHS.teamChoice}?team=${encodeURIComponent(teamId)}`,
          ]}
        >
          <App />
        </MemoryRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

function seedTeam(id: string, characterIds: readonly string[]): TeamPlan {
  const team = emptyTeam(id);
  team.cycles = 1;
  characterIds.forEach((characterId, slot) => {
    team.members[slot] = { characterId, options: {}, skill: "kit" };
  });
  useTeamStore.setState({ teams: [team], activeTeamId: team.id });
  return team;
}

async function resultsCard() {
  return screen.findByRole(
    "region",
    { name: "Choice Results" },
    { timeout: 15_000 }
  );
}

afterEach(() => {
  stubbedSetPlans.entries = null;
  stubbedSetPlans.gate = null;
  stubbedSetPlans.slots = [];
  useTeamStore.setState(structuredClone(DEFAULT_TEAM_STORE));
  clearResultCache();
});

const entry = (
  relative: number,
  overrides: Partial<CompareEntry> = {}
): CompareEntry => ({ damage: relative * 1000, relative, ...overrides });

function preview(overrides: Partial<MemberPreview>): MemberPreview {
  return {
    slot: 0,
    characterId: "1102",
    owned: false,
    level: 80,
    eidolon: 0,
    eidolonOrigin: "default",
    accountEidolon: null,
    lightCone: null,
    lightConeOrigin: "recommended",
    relicSource: "ideal",
    equippedRelics: [],
    plannedSets: { cavern: [], planar: null },
    setPlanOrigin: "recommended",
    mainStats: {},
    ...overrides,
  };
}

describe("Choice ranking rules", () => {
  it("highlights rows within 1% of the best, five at most", () => {
    expect(
      topRowCount([entry(1), entry(0.995), entry(0.99), entry(0.98)])
    ).toBe(3);
    expect(topRowCount(Array.from({ length: 8 }, () => entry(1)))).toBe(5);
    expect(topRowCount([])).toBe(0);
  });

  it("matches the member's current Light Cone and set plan", () => {
    const member = preview({
      lightCone: { id: "23001", superimposition: 3 },
      plannedSets: { cavern: ["102", "101"], planar: "302" },
    });
    expect(
      isCurrentEntry(
        entry(1, { lightCone: { id: "23001", superimposition: 1 } }),
        member
      )
    ).toBe(true);
    const split = entry(1, {
      plan: { cavern: { twoPlusTwo: ["101", "102"] }, planar: "302" },
    });
    expect(isCurrentEntry(split, member)).toBe(true);
    const four = entry(0.9, {
      plan: { cavern: { fourPiece: "102" }, planar: "302" },
    });
    expect(isCurrentEntry(four, member)).toBe(false);
    // A 2+2 of one set is the 4-piece plan.
    expect(
      entrySets(
        entry(1, {
          plan: { cavern: { twoPlusTwo: ["104", "104"] }, planar: null },
        })
      )
    ).toEqual({ cavern: ["104"], planar: null });
    expect(currentBonuses(preview({ relicSource: "equipped" }))).toEqual({
      cavern: [],
      planar: null,
    });
    // Candidates shared by members (one Path, one pool) count once.
    expect(
      candidateCount({ rankings: { 0: [split, four], 2: [four] }, failed: [] })
    ).toBe(2);
  });
});

describe("Equipped Cavern bonuses in Choice", () => {
  const worn = (slot: Relic["slot"], setId: string) =>
    ({ slot, setId }) as unknown as Relic;

  it("keeps a lone 2-piece apart from that set's 4-piece plan", () => {
    // Head and Hands of one set, Body and Feet off-set: one 2-piece bonus.
    const member = preview({
      relicSource: "equipped",
      equippedRelics: [
        worn("head", "101"),
        worn("hands", "101"),
        worn("body", "102"),
        worn("feet", "103"),
        worn("planarSphere", "301"),
        worn("linkRope", "301"),
      ],
    });
    expect(currentBonuses(member)).toEqual({
      cavern: [{ setId: "101", tier: 2 }],
      planar: "301",
    });
    const four = entry(1, {
      plan: { cavern: { fourPiece: "101" }, planar: "301" },
    });
    expect(isCurrentEntry(four, member)).toBe(false);
  });

  it("matches a worn 4-piece and a worn 2+2 to their plans", () => {
    const four = preview({
      relicSource: "equipped",
      equippedRelics: ["head", "hands", "body", "feet"].map((slot) =>
        worn(slot as Relic["slot"], "101")
      ),
    });
    expect(
      isCurrentEntry(
        entry(1, { plan: { cavern: { fourPiece: "101" }, planar: null } }),
        four
      )
    ).toBe(true);
    const split = preview({
      relicSource: "equipped",
      equippedRelics: [
        worn("head", "102"),
        worn("hands", "102"),
        worn("body", "101"),
        worn("feet", "101"),
      ],
    });
    expect(
      isCurrentEntry(
        entry(1, {
          plan: { cavern: { twoPlusTwo: ["101", "102"] }, planar: null },
        }),
        split
      )
    ).toBe(true);
  });
});

describe("Team DMG Light Cone & Relic Choice", () => {
  it("switches between Light Cone and Relics rankings", async () => {
    const user = userEvent.setup();
    seedTeam("team:choice-modes", ["1102", "1309"]);
    renderChoice("team:choice-modes");
    const card = await resultsCard();

    const lightCone = within(card).getByRole("radio", { name: "Light Cone" });
    const relics = within(card).getByRole("radio", { name: "Relics" });
    expect(lightCone).toHaveAttribute("aria-checked", "true");
    expect(card.querySelectorAll("[data-constraint-tile]")).toHaveLength(2);
    for (const name of ["Seele", "Robin"])
      expect(
        within(within(card).getByRole("article", { name })).getByText(
          "No results yet"
        )
      ).toBeInTheDocument();

    await user.click(relics);
    expect(relics).toHaveAttribute("aria-checked", "true");
    expect(lightCone).toHaveAttribute("aria-checked", "false");
    expect(
      within(card).getByRole("button", { name: "Run Analysis" })
    ).toBeEnabled();
  }, 30_000);

  it("ranks one member's Light Cones and applies one from its detail", async () => {
    const user = userEvent.setup();
    seedTeam("team:choice-run", ["1102"]);
    renderChoice("team:choice-run");
    const card = await resultsCard();
    const seele = within(card).getByRole("article", { name: "Seele" });

    await user.click(
      within(card).getByRole("button", { name: "Run Analysis" })
    );
    const rows = await waitFor(
      () => {
        const items = within(seele).getAllByRole("listitem");
        expect(items.length).toBeGreaterThan(1);
        return items;
      },
      { timeout: 90_000 }
    );

    // Best first, as a share of the best; top rows highlighted.
    const shares = rows.map((row) =>
      Number(row.querySelector<HTMLElement>("[data-share]")?.dataset.share)
    );
    expect(shares[0]).toBe(1);
    expect([...shares].sort((a, b) => b - a)).toEqual(shares);
    expect(rows[0]).toHaveTextContent("100.0%");
    expect(rows[0]).toHaveTextContent(/S[15]/);
    expect(rows[0]?.querySelector("[data-top]")).not.toBeNull();
    expect(rows.filter((row) => row.querySelector("[data-top]"))).toHaveLength(
      Math.min(5, shares.filter((share) => share >= 0.99).length)
    );
    expect(
      within(card).getByRole("radio", { name: /Light Cone/ })
    ).toHaveTextContent(`${rows.length} candidates`);

    // The member's current (recommended) Light Cone is ringed.
    const current = seele.querySelectorAll("[data-current]");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Current");

    // A row's detail: total damage, the four variable main stats, rolls.
    const other = rows.find((row) => !row.querySelector("[data-current]"));
    if (!other) throw new Error("Expected a non-current Light Cone row");
    const otherName =
      other.querySelector(".truncate")?.textContent?.trim() ?? "";
    await user.click(within(other).getByRole("button"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Total DMG")).toBeInTheDocument();
    const mainStats = dialog.querySelector("[data-choice-main-stats]");
    expect(mainStats).not.toBeNull();
    const slots = [
      ...(mainStats?.querySelectorAll("[data-slot]") ?? []),
    ] as HTMLElement[];
    expect(slots.map((slot) => slot.dataset.slot)).toEqual([
      "body",
      "feet",
      "planarSphere",
      "linkRope",
    ]);
    expect(slots.map((slot) => slot.querySelector("dt")?.textContent)).toEqual([
      "Body",
      "Feet",
      "Planar Sphere",
      "Link Rope",
    ]);
    for (const slot of slots)
      expect(slot.querySelector("dd")?.textContent).not.toBe("—");
    expect(
      dialog.querySelectorAll("[data-choice-rolls] > div").length
    ).toBeGreaterThan(0);

    // Using it writes the member's Light Cone; the ranking stays.
    await user.click(
      within(dialog).getByRole("button", { name: "Use this Light Cone" })
    );
    const member = useTeamStore.getState().teams[0]?.members[0];
    expect(member?.lightCone?.id).toBeDefined();
    await waitFor(() => {
      const ringed = seele.querySelector("[data-current]");
      expect(ringed?.textContent).toContain(otherName);
    });
    expect(within(seele).getAllByRole("listitem")).toHaveLength(rows.length);
  }, 120_000);

  it("ranks set plans as a Cavern plan plus a Planar set", async () => {
    const ideal = {
      mainStats: {
        head: "HPDelta",
        hands: "AttackDelta",
        body: "CriticalDamageBase",
        feet: "SpeedDelta",
        planarSphere: "QuantumAddedRatio",
        linkRope: "AttackAddedRatio",
      },
      rolls: { CriticalChanceBase: 12, CriticalDamageBase: 10 },
    };
    stubbedSetPlans.entries = [
      {
        plan: { cavern: { twoPlusTwo: ["101", "102"] }, planar: "302" },
        damage: 1000,
        relative: 1,
        ideal,
      },
      {
        plan: { cavern: { fourPiece: "104" }, planar: "305" },
        damage: 950,
        relative: 0.95,
        ideal,
      },
    ] satisfies CompareEntry[];
    const user = userEvent.setup();
    seedTeam("team:choice-relics", ["1102"]);
    renderChoice("team:choice-relics");
    const card = await resultsCard();
    await user.click(within(card).getByRole("radio", { name: "Relics" }));
    await user.click(
      within(card).getByRole("button", { name: "Run Analysis" })
    );
    const seele = within(card).getByRole("article", { name: "Seele" });
    const rows = await within(seele).findAllByRole("listitem");

    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector('[data-set-plan="split"]')).not.toBeNull();
    expect(rows[0]).toHaveTextContent(
      "Passerby of Wandering Cloud 2 + Musketeer of Wild Wheat 2 + Fleet of the Ageless"
    );
    expect(rows[1]?.querySelector('[data-set-plan="four"]')).not.toBeNull();
    expect(rows[1]).toHaveTextContent(
      "Hunter of Glacial Forest 4 + Celestial Differentiator"
    );
    expect(
      within(card).getByRole("radio", { name: /Relics/ })
    ).toHaveTextContent("2 candidates");

    // The visible Cavern line keeps the 4-piece count out of the truncation.
    const cavernLine = rows[1]?.querySelector('[aria-hidden="true"].flex');
    expect(cavernLine).toHaveTextContent(/^Hunter of Glacial Forest 4$/);
    expect(cavernLine?.querySelector(".truncate")).toHaveTextContent(
      /^Hunter of Glacial Forest$/
    );

    await user.click(within(rows[1] as HTMLElement).getByRole("button"));
    const dialog = await screen.findByRole("dialog");
    expect(
      dialog.querySelector('[data-slot="planarSphere"] dd')
    ).toHaveTextContent("Quantum");
    // Two tiles a side: the art row (candidate, then Current) above the name.
    const art = dialog.querySelector("[data-choice-art]");
    expect(art?.querySelector('[data-set-plan="four"]')).not.toBeNull();
    expect(art?.querySelector("[data-choice-now]")).toHaveTextContent(
      "Current"
    );
    expect(
      art?.compareDocumentPosition(
        dialog.querySelector("[data-choice-title]") as Node
      )
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await user.click(
      within(dialog).getByRole("button", { name: "Use these sets" })
    );
    expect(useTeamStore.getState().teams[0]?.members[0]?.setPlan).toEqual({
      cavern: ["104"],
      planar: "305",
    });
    await waitFor(() =>
      expect(rows[1]?.querySelector("[data-current]")).not.toBeNull()
    );
    expect(within(seele).getAllByRole("listitem")).toHaveLength(2);
  }, 30_000);

  it("spins only for the member being compared", async () => {
    let release = () => {};
    stubbedSetPlans.gate = new Promise((resolve) => {
      release = resolve;
    });
    stubbedSetPlans.entries = [
      {
        plan: { cavern: { fourPiece: "104" }, planar: "305" },
        damage: 1000,
        relative: 1,
      },
    ] satisfies CompareEntry[];
    const user = userEvent.setup();
    seedTeam("team:choice-queue", ["1102", "1309"]);
    renderChoice("team:choice-queue");
    const card = await resultsCard();
    await user.click(within(card).getByRole("radio", { name: "Relics" }));
    await user.click(
      within(card).getByRole("button", { name: "Run Analysis" })
    );

    const seele = within(card).getByRole("article", { name: "Seele" });
    const robin = within(card).getByRole("article", { name: "Robin" });
    await waitFor(() =>
      expect(
        seele.querySelector('[data-choice-placeholder="computing"]')
      ).not.toBeNull()
    );
    expect(
      robin.querySelector('[data-choice-placeholder="queued"]')
    ).not.toBeNull();
    expect(
      robin.querySelector('[data-choice-placeholder="computing"]')
    ).toBeNull();
    // The mode stays on the run's until it ends.
    for (const name of ["Light Cone", "Relics"])
      expect(within(card).getByRole("radio", { name })).toBeDisabled();

    release();
    await waitFor(() =>
      expect(within(robin).getAllByRole("listitem")).toHaveLength(1)
    );
    expect(within(seele).getAllByRole("listitem")).toHaveLength(1);
    expect(
      within(card).getByRole("radio", { name: "Light Cone" })
    ).toBeEnabled();
  }, 30_000);

  it("keeps the other members' rankings when one member's floor changes", async () => {
    stubbedSetPlans.entries = [
      {
        plan: { cavern: { fourPiece: "104" }, planar: "305" },
        damage: 1000,
        relative: 1,
      },
    ] satisfies CompareEntry[];
    const user = userEvent.setup();
    seedTeam("team:choice-floors", ["1102", "1309"]);
    renderChoice("team:choice-floors");
    const card = await resultsCard();
    await user.click(within(card).getByRole("radio", { name: "Relics" }));
    await user.click(
      within(card).getByRole("button", { name: "Run Analysis" })
    );
    const seele = within(card).getByRole("article", { name: "Seele" });
    const robin = within(card).getByRole("article", { name: "Robin" });
    await waitFor(() =>
      expect(within(robin).getAllByRole("listitem")).toHaveLength(1)
    );
    expect(stubbedSetPlans.slots).toEqual([0, 1]);

    const floors = card.querySelector('[data-constraint-tile="1309"]');
    const speed = within(floors as HTMLElement).getByLabelText("SPD ≥");
    await user.type(speed, "134{Enter}");
    expect(within(robin).getByText("No results yet")).toBeInTheDocument();
    expect(within(seele).getAllByRole("listitem")).toHaveLength(1);

    // Running again compares only the member without a ranking.
    await user.click(
      within(card).getByRole("button", { name: "Run Analysis" })
    );
    await waitFor(() =>
      expect(within(robin).getAllByRole("listitem")).toHaveLength(1)
    );
    expect(stubbedSetPlans.slots).toEqual([0, 1, 1]);
    expect(within(seele).getAllByRole("listitem")).toHaveLength(1);
  }, 30_000);

  it("keeps only the applied member's ranking after Use these sets", async () => {
    const ideal = { mainStats: {}, rolls: { CriticalDamageBase: 10 } };
    stubbedSetPlans.entries = [
      {
        plan: { cavern: { fourPiece: "104" }, planar: "305" },
        damage: 1000,
        relative: 1,
        ideal,
      },
      {
        plan: { cavern: { twoPlusTwo: ["101", "102"] }, planar: "302" },
        damage: 990,
        relative: 0.99,
        ideal,
      },
    ] satisfies CompareEntry[];
    const user = userEvent.setup();
    seedTeam("team:choice-apply", ["1102", "1309"]);
    renderChoice("team:choice-apply");
    const card = await resultsCard();
    await user.click(within(card).getByRole("radio", { name: "Relics" }));
    await user.click(
      within(card).getByRole("button", { name: "Run Analysis" })
    );
    const seele = within(card).getByRole("article", { name: "Seele" });
    const robin = within(card).getByRole("article", { name: "Robin" });
    await waitFor(() =>
      expect(within(robin).getAllByRole("listitem")).toHaveLength(2)
    );
    const rows = within(seele).getAllByRole("listitem");
    const other = rows.find((row) => !row.querySelector("[data-current]"));
    if (!other) throw new Error("Expected a non-current set plan row");
    await user.click(within(other).getByRole("button"));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Use these sets",
      })
    );

    // Robin's ranking was computed with Seele's old sets: it is run again.
    await waitFor(() =>
      expect(within(robin).getByText("No results yet")).toBeInTheDocument()
    );
    expect(within(seele).getAllByRole("listitem")).toHaveLength(2);
    await user.click(
      within(card).getByRole("button", { name: "Run Analysis" })
    );
    await waitFor(() =>
      expect(within(robin).getAllByRole("listitem")).toHaveLength(2)
    );
    expect(stubbedSetPlans.slots).toEqual([0, 1, 1]);
  }, 30_000);

  it("shows the empty line without Characters", async () => {
    seedTeam("team:choice-empty", []);
    renderChoice("team:choice-empty");
    expect(
      await screen.findByText("No Characters", {}, { timeout: 15_000 })
    ).toBeInTheDocument();
  }, 30_000);
});

describe("Choice row hover card", () => {
  /** A row whose click opens its detail in a dialog, as on desktop. */
  function Row() {
    const [dialog, setDialog] = useState(false);
    return (
      <>
        <ChoiceHoverCard disabled={dialog} content={<p>Row detail</p>}>
          <button type="button" onClick={() => setDialog(true)}>
            Row
          </button>
        </ChoiceHoverCard>
        {dialog && (
          <button type="button" onClick={() => setDialog(false)}>
            Close
          </button>
        )}
      </>
    );
  }
  const pause = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  it("stays closed after the row's dialog closes", async () => {
    const user = userEvent.setup();
    render(<Row />);
    const row = screen.getByRole("button", { name: "Row" });

    await user.click(row);
    await user.click(screen.getByRole("button", { name: "Close" }));
    await pause(500);
    expect(screen.queryByText("Row detail")).toBeNull();

    await user.hover(row);
    expect(await screen.findByText("Row detail")).toBeInTheDocument();
    await user.click(row);
    expect(screen.queryByText("Row detail")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await pause(500);
    expect(screen.queryByText("Row detail")).toBeNull();
  });
});
