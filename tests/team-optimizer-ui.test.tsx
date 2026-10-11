import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { statConstraints } from "@/components/damage/optimizer/ConstraintTiles";
import { DamagePill } from "@/components/damage/optimizer/DamagePill";
import { PanelView } from "@/components/damage/optimizer/StatViews";
import { buildSwapGuide } from "@/components/damage/optimizer/swapGuide";
import {
  memberTimelineSummaries,
  timelineRails,
} from "@/components/damage/optimizer/timeline";
import { APP_PATHS } from "@/config/navigation";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { AccountSnapshot } from "@/domain/account/schemas";
import seele from "@/domain/combat/impl/characters/1102-seele";
import genius from "@/domain/combat/impl/relicSets/108-genius-of-brilliant-stars";
import rutilant from "@/domain/combat/impl/relicSets/309-rutilant-arena";
import { createKitRegistry } from "@/domain/combat/kit/registry";
import { TeamObjective } from "@/domain/combat/optimize/objective";
import { searchRelics } from "@/domain/combat/optimize/relicSearch";
import {
  PLANAR_SLOTS,
  RELIC_SLOTS,
  type RelicPiece,
} from "@/domain/combat/optimize/relics";
import { SCENARIO_PRESETS } from "@/domain/combat/team/input";
import { I18nProvider } from "@/i18n/I18nContext";
import type {
  MemberPanelSummary,
  SimulateResponse,
  TimelineAction,
} from "@/lib/combat/jobs";
import { loadCombatReferenceData } from "@/lib/combat/referenceData";
import { buildRelicTables } from "@/lib/combat/relicTables";
import { clearResultCache, resultCacheKey } from "@/lib/combat/resultCache";
import {
  loadProgression,
  loadRelicPieces,
} from "@/providers/reference/catalog";
import {
  DEFAULT_TEAM_STORE,
  emptyTeam,
  type TeamPlan,
} from "@/stores/teamSchemas";
import { useTeamStore } from "@/stores/useTeamStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { createDemoAccount } from "./fixtures/demoAccount";

const TEAM_ID = "team:optimizer";
const ROUTE = `${APP_PATHS.teamDamage}?team=${encodeURIComponent(TEAM_ID)}`;

function renderPage(path = ROUTE) {
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

/** Dan Heng wears demo-account Relics; Robin is not owned (ideal Relics). */
function seedTeam(characterIds = ["1002", "1309"]): TeamPlan {
  const team = emptyTeam(TEAM_ID);
  team.name = "Optimizer test";
  team.cycles = 2;
  characterIds.forEach((characterId, slot) => {
    team.members[slot] = { characterId, options: {}, skill: "kit" };
  });
  useTeamStore.setState({ teams: [team], activeTeamId: team.id });
  return team;
}

async function seedAccount() {
  const account = await createDemoAccount(new Date("2026-09-02T00:00:00Z"));
  act(() => useWorkspaceStore.getState().replaceAccount(account));
}

async function relicsCard() {
  return screen.findByRole(
    "region",
    { name: "Relics & Damage" },
    { timeout: 20_000 }
  );
}

async function simulated(card: HTMLElement) {
  await waitFor(
    () =>
      expect(
        card.querySelector("[data-damage-per-cycle]")?.textContent
      ).toMatch(/\d/),
    { timeout: 30_000 }
  );
}

afterEach(() => {
  clearResultCache();
  act(() => {
    useTeamStore.setState(structuredClone(DEFAULT_TEAM_STORE));
    useWorkspaceStore.getState().clearWorkspace();
  });
});

describe("Battle Timeline data", () => {
  const action = (
    overrides: Partial<TimelineAction> & Pick<TimelineAction, "time">
  ): TimelineAction => ({
    cycle: 0,
    unitId: "unit:a",
    abilityId: "skill",
    abilityKind: "skill",
    mode: "turn",
    skillPointsAfter: 3,
    energyAfter: 60,
    slot: 0,
    unitKind: "character",
    ...overrides,
  });

  it("splits actions per cycle with Skill Point and Energy changes", () => {
    const result = {
      members: [
        { slot: 0, ultimateEnergy: true },
        { slot: 1, ultimateEnergy: true },
      ],
      report: { byCycle: [100, 250] },
      startingSkillPoints: 3,
      actions: [
        action({ time: 50, skillPointsAfter: 2, energyAfter: 90 }),
        action({
          time: 60,
          unitId: "unit:b",
          slot: 1,
          abilityKind: "basic",
          skillPointsAfter: 3,
          energyAfter: 20,
        }),
        action({
          time: 120,
          cycle: 0,
          mode: "ultimate",
          abilityKind: "ultimate",
          skillPointsAfter: 3,
          energyAfter: 5,
        }),
        action({
          time: 170,
          cycle: 1,
          unitId: "unit:memo",
          unitKind: "memosprite",
          abilityKind: "memospriteSkill",
          skillPointsAfter: 3,
          energyAfter: 0,
        }),
        action({ time: 180, cycle: 1, skillPointsAfter: 2, energyAfter: 35 }),
      ],
    } as unknown as SimulateResponse;

    const rails = timelineRails(result);
    expect(rails.map((rail) => rail.chips.length)).toEqual([3, 2]);
    expect(rails.map((rail) => rail.damage)).toEqual([100, 250]);
    const [first, second, ultimate] = rails[0]?.chips ?? [];
    // The first action spends from the battle's starting Skill Points.
    expect(first?.skillPointDelta).toBe(-1);
    expect(first?.energyDelta).toBeNull();
    expect(second?.skillPointDelta).toBe(1);
    expect(ultimate?.energyDelta).toBe(-85);
    const [memo, last] = rails[1]?.chips ?? [];
    expect(memo?.energyDelta).toBeNull();
    expect(last?.skillPointDelta).toBe(-1);
    expect(last?.energyDelta).toBe(30);
    expect(rails.map((rail) => rail.skillPointsAfter)).toEqual([3, 2]);

    const summaries = memberTimelineSummaries(result);
    expect(summaries.get(0)).toEqual({
      slot: 0,
      ultimates: 1,
      actions: 4,
      energy: 35,
    });
    expect(summaries.get(1)?.actions).toBe(1);
  });

  it("leaves out Energy for Ultimates paid with a kit resource", () => {
    const result = {
      members: [{ slot: 0, ultimateEnergy: false }],
      report: { byCycle: [100] },
      startingSkillPoints: 3,
      actions: [
        action({ time: 50, skillPointsAfter: 2, energyAfter: 3 }),
        action({ time: 90, skillPointsAfter: 1, energyAfter: 6 }),
      ],
    } as unknown as SimulateResponse;

    const chips = timelineRails(result)[0]?.chips ?? [];
    expect(chips.map((chip) => chip.skillPointDelta)).toEqual([-1, -1]);
    expect(chips.map((chip) => chip.energyDelta)).toEqual([null, null]);
    expect(memberTimelineSummaries(result).get(0)?.energy).toBeNull();
  });
});

describe("Damage pill", () => {
  it("offers no breakdown before a result exists", () => {
    render(
      <ThemeProvider>
        <I18nProvider>
          <DamagePill
            result={null}
            reference={null}
            running={false}
            cycles={3}
            critMode="expected"
            onCritModeChange={() => {}}
          />
        </I18nProvider>
      </ThemeProvider>
    );
    const pill = screen.getByRole("button", { name: /DMG per cycle/ });
    expect(pill).toBeDisabled();
    expect(pill).not.toHaveAttribute("aria-expanded");
    expect(pill).not.toHaveTextContent(/Expand|Collapse/);
  });
});

describe("Analysis result keys", () => {
  it("ignore the team's name, so renaming keeps finished results", () => {
    const team = seedTeam();
    const sources = { account: null, characterLightConeIds: {}, builds: [] };
    const key = resultCacheKey("optimizer", "optimize", team, sources);
    expect(
      resultCacheKey(
        "optimizer",
        "optimize",
        { ...team, name: "Renamed" },
        sources
      )
    ).toBe(key);
    expect(
      resultCacheKey("optimizer", "optimize", { ...team, cycles: 5 }, sources)
    ).not.toBe(key);
  });
});

describe("Energy Regeneration Rate as the panel total", () => {
  const ENERGY_REGEN = "SPRatioBase";

  it("shows ERR from the 100% base, like CRIT stats with theirs", () => {
    const panel: MemberPanelSummary = {
      hp: 3000,
      atk: 2500,
      def: 1000,
      spd: 134,
      critRate: 0.05,
      critDmg: 0.5,
      breakEffect: 0,
      outgoingHealing: 0,
      energyRegen: 0.1944,
      effectHitRate: 0,
      effectRes: 0,
      combatType: "Quantum",
      combatTypeDmg: 0.388,
      elation: 0,
    };
    render(
      <ThemeProvider>
        <I18nProvider>
          <PanelView panel={panel} />
        </I18nProvider>
      </ThemeProvider>
    );
    const row = (name: string) =>
      screen.getByRole("rowheader", { name }).closest("tr");
    expect(row("ERR")).toHaveTextContent("119.4%");
    expect(row("CR")).toHaveTextContent("5%");
    expect(row("CD")).toHaveTextContent("50%");
    // The member's own Combat Type DMG Boost; zero optional stats are left out.
    expect(row("Quantum%")).toHaveTextContent("38.8%");
    expect(screen.queryByRole("rowheader", { name: "OHB" })).toBeNull();
    expect(screen.queryByRole("rowheader", { name: "RES" })).toBeNull();
  });

  it("reads ERR ≥ as a total: 119.4 is met by a 19.4% Link Rope", async () => {
    expect(
      statConstraints({ minSpeed: null, minEnergyRegenPercent: 100 })
    ).toEqual({ minEnergyRegen: 0 });
    expect(
      statConstraints({ minSpeed: null, minEnergyRegenPercent: 119.4 })
        ?.minEnergyRegen
    ).toBeCloseTo(0.194, 6);

    const [data, progression, catalogPieces] = await Promise.all([
      loadCombatReferenceData(),
      loadProgression(),
      loadRelicPieces(),
    ]);
    const tables = buildRelicTables(progression, catalogPieces.values);
    const objective = new TeamObjective(
      {
        members: [
          {
            characterId: "1102",
            level: 80,
            eidolon: 0,
            traces: {},
            lightCone: null,
            relics: { stats: {}, sets: {} },
          },
        ],
        scenario: { ...SCENARIO_PRESETS.singleBoss, cycles: 1 },
      },
      0,
      data,
      createKitRegistry({
        characters: [seele],
        lightCones: [],
        relicSets: [genius, rutilant],
      })
    );
    // One piece per slot; the only ERR is the Link Rope's main stat.
    const pieces: RelicPiece[] = RELIC_SLOTS.map((slot) => {
      const mainStat =
        slot === "linkRope"
          ? ENERGY_REGEN
          : (tables
              .mainStatOptions(slot)
              .find((property) => property !== ENERGY_REGEN) ?? "");
      return {
        key: `piece:${slot}`,
        slot,
        setId: PLANAR_SLOTS.includes(slot) ? "309" : "108",
        mainStat,
        stats: { [mainStat]: tables.mainStatValue(slot, mainStat) ?? 0 },
      };
    });
    expect(pieces.at(-1)?.stats[ENERGY_REGEN]).toBeCloseTo(0.1944, 4);

    const search = (minEnergyRegenPercent: number) =>
      searchRelics(objective, tables, {
        pieces,
        constraints: statConstraints({
          minSpeed: null,
          minEnergyRegenPercent,
        }),
      }).loadouts;
    expect(search(119.4).length).toBeGreaterThan(0);
    expect(search(120)).toHaveLength(0);
  }, 60_000);
});

describe("Relic Swap Guide data", () => {
  it("labels each recommended Relic and flags shared ones", () => {
    const relic = (key: string, slot: string, equippedCharacterKey?: string) =>
      ({ key, slot, setId: "101", equippedCharacterKey }) as const;
    const account = {
      characters: [
        { key: "c:a", definitionId: "1001", relicKeys: ["r:head"] },
        { key: "c:b", definitionId: "1002", relicKeys: ["r:hands"] },
      ],
      relics: [
        relic("r:head", "head", "c:a"),
        relic("r:hands", "hands", "c:b"),
        relic("r:body", "body"),
      ],
    } as unknown as AccountSnapshot;

    const guide = buildSwapGuide(
      [
        {
          teamSlot: 0,
          characterId: "1001",
          relicKeys: { head: "r:head", hands: "r:hands", body: "r:body" },
        },
        { teamSlot: 2, characterId: "1309", relicKeys: { body: "r:body" } },
      ],
      account
    );

    const [first, second] = guide.columns;
    expect(first?.rows.map((row) => row.slot)).toEqual([
      "head",
      "hands",
      "body",
      "feet",
      "planarSphere",
      "linkRope",
    ]);
    expect(first?.rows.map((row) => row.status)).toEqual([
      { kind: "equipped" },
      { kind: "swap", fromCharacterId: "1002" },
      { kind: "inventory" },
      null,
      null,
      null,
    ]);
    expect(first?.rows.map((row) => row.conflict)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(second?.rows.find((row) => row.slot === "body")?.conflict).toBe(
      true
    );
    expect(guide.changes).toBe(3);
  });
});

describe("DMG Optimizer detail", () => {
  it("shows the current team: 4 + 2 Relic grids, the stat panel and the damage pill", async () => {
    const user = userEvent.setup();
    await seedAccount();
    seedTeam();
    renderPage();
    const card = await relicsCard();
    expect(
      within(card).getByRole("radio", { name: "Current" })
    ).toHaveAttribute("aria-checked", "true");
    await simulated(card);

    // Equipped Relics: four Cavern Relics, then two Planar Ornaments.
    const danHeng = await within(card).findByRole(
      "article",
      { name: "Dan Heng" },
      { timeout: 10_000 }
    );
    const grid = danHeng.querySelector("[data-relic-slot-grid]");
    expect(grid?.querySelectorAll('[data-relic-kind="cavern"]')).toHaveLength(
      4
    );
    expect(grid?.querySelectorAll('[data-relic-kind="planar"]')).toHaveLength(
      2
    );
    expect(
      grid?.querySelectorAll('[data-item-icon-kind="relic-piece"]').length
    ).toBeGreaterThan(0);

    // Ideal Relics: main-stat chips with the fixed Head and Hands stats.
    const robin = within(card).getByRole("article", { name: "Robin" });
    const fixed = [...robin.querySelectorAll("[data-main-stat]")].map((chip) =>
      chip.getAttribute("data-main-stat")
    );
    expect(fixed.slice(0, 2)).toEqual(["HPDelta", "AttackDelta"]);
    expect(robin.querySelector('[data-set-plan="planar"]')).not.toBeNull();

    await user.click(within(danHeng).getByRole("button", { name: /Panel/ }));
    const stats = within(danHeng).getByRole("table", { name: "Battle stats" });
    expect(within(stats).getByRole("rowheader", { name: "SPD" })).toBeVisible();

    // The pill: crit mode, damage per cycle, then the breakdown.
    expect(
      within(card).getByRole("combobox", { name: "Crit mode" })
    ).toHaveTextContent("Expected");
    const pill = within(card).getByRole("button", { name: /DMG per cycle/ });
    expect(pill).toHaveAttribute("aria-expanded", "false");
    await user.click(pill);
    const byAbility = within(card).getByRole("region", { name: "By ability" });
    expect(
      byAbility.querySelectorAll("[data-damage-member]").length
    ).toBeGreaterThanOrEqual(2);
    expect(byAbility).toHaveTextContent(/×.*=/);
    expect(
      within(card).getByRole("region", { name: "By cycle" })
    ).toHaveTextContent("Cycle 2");
  }, 60_000);

  it("draws one Battle Timeline rail per cycle", async () => {
    const user = userEvent.setup();
    seedTeam(["1102", "1309"]);
    renderPage();
    await simulated(await relicsCard());
    const timeline = screen.getByRole("region", { name: "Battle Timeline" });
    expect(timeline.querySelector("[data-timeline-rail]")).toBeNull();
    await user.click(
      within(timeline).getByRole("button", { name: /Battle Timeline/ })
    );
    const rails = timeline.querySelectorAll("[data-timeline-rail]");
    expect(rails).toHaveLength(2);
    expect(rails[0]).toHaveTextContent("Cycle 1");
    expect(
      timeline.querySelectorAll("[data-timeline-action]").length
    ).toBeGreaterThan(2);
    expect(timeline).toHaveTextContent(/SP [+−]1/);
    expect(timeline).toHaveTextContent(/Energy [+−]\d/);
    expect(
      timeline.querySelectorAll("[data-timeline-member]").length
    ).toBeGreaterThanOrEqual(2);
    expect(
      timeline.querySelector("[data-timeline-skill-points]")
    ).not.toBeNull();
  }, 60_000);

  it("optimizes every member from the inventory and guides the swaps", async () => {
    const user = userEvent.setup();
    await seedAccount();
    seedTeam();
    renderPage();
    const card = await relicsCard();
    await simulated(card);
    await user.click(within(card).getByRole("radio", { name: /Optimize/ }));
    expect(
      within(card).getByRole("radio", { name: /Optimize/ })
    ).toHaveTextContent(/\d+ Relics/);
    expect(within(card).getAllByRole("group")).toHaveLength(2);
    expect(within(card).getByText("No results yet")).toBeVisible();

    const speed = within(
      within(card).getByRole("group", { name: "Dan Heng" })
    ).getByRole("spinbutton", { name: "SPD ≥" });
    await user.type(speed, "90{Enter}");
    await user.click(within(card).getByRole("button", { name: "Optimize" }));

    const guide = await within(card).findByRole(
      "region",
      { name: "Relic Swap Guide" },
      { timeout: 60_000 }
    );
    const danHeng = within(card).getByRole("article", { name: "Dan Heng" });
    expect(danHeng.querySelector("[data-delta]")).not.toBeNull();
    expect(
      danHeng.querySelectorAll('[data-item-icon-kind="relic-piece"]').length
    ).toBeGreaterThan(0);
    expect(card.querySelector("[data-vs-current]")?.textContent).toMatch(
      /^[+−]\d/
    );

    await user.click(
      within(guide).getByRole("button", { name: /Relic Swap Guide/ })
    );
    const columns = within(guide).getAllByRole("article");
    expect(columns.length).toBeGreaterThan(0);
    const slots = [
      ...(columns[0] as HTMLElement).querySelectorAll("[data-swap-slot]"),
    ].map((row) => row.getAttribute("data-swap-slot"));
    expect(slots).toEqual([
      "head",
      "hands",
      "body",
      "feet",
      "planarSphere",
      "linkRope",
    ]);
    expect(
      (columns[0] as HTMLElement).querySelector('[data-swap-group="planar"]')
    ).not.toBeNull();
    expect(guide.querySelectorAll("[data-swap-status]").length).toBeGreaterThan(
      0
    );
  }, 120_000);

  it("generates ideal Relics with a chosen main stat", async () => {
    const user = userEvent.setup();
    seedTeam(["1102"]);
    renderPage();
    const card = await relicsCard();
    await simulated(card);
    await user.click(within(card).getByRole("radio", { name: "Ideal" }));
    const seele = within(card).getByRole("article", { name: "Seele" });

    await user.click(
      within(seele).getByRole("button", { name: "Seele · Main stat filter" })
    );
    const filter = await screen.findByRole("dialog");
    await user.click(within(filter).getByRole("combobox", { name: "Body" }));
    await user.click(await screen.findByRole("option", { name: "ATK%" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(within(card).getByRole("button", { name: "Generate" }));
    await waitFor(
      () => expect(seele.querySelector("[data-delta]")).not.toBeNull(),
      { timeout: 60_000 }
    );
    const body = seele.querySelector('[data-relic-slot="body"]');
    expect(
      body?.querySelector("[data-main-stat]")?.getAttribute("data-main-stat")
    ).toBe("AttackAddedRatio");
    await user.click(within(seele).getByRole("button", { name: /Panel/ }));
    const panel = within(seele).getByRole("table", { name: "Battle stats" });
    for (const stat of ["SPD", "CR", "CD", "BE", "ERR", "EHR"])
      expect(
        within(panel).getByRole("rowheader", { name: stat })
      ).toBeVisible();
    await user.click(within(seele).getByRole("button", { name: /Rolls/ }));
    expect(
      within(seele).getByRole("table", { name: "Substat rolls" })
    ).toBeVisible();
    await user.click(within(seele).getByRole("button", { name: /Value/ }));
    expect(
      within(seele).getByRole("table", { name: "Stat value" })
    ).toBeVisible();
  }, 120_000);

  it("requires imported Relics before optimizing", async () => {
    const user = userEvent.setup();
    seedTeam(["1102"]);
    renderPage();
    const card = await relicsCard();
    await simulated(card);
    await user.click(within(card).getByRole("radio", { name: /Optimize/ }));
    expect(
      within(card).getByText("Requires imported 5★ Relics at +12 or higher.")
    ).toBeVisible();
    expect(
      within(card).getByRole("link", { name: "Inventory" })
    ).toHaveAttribute("href", APP_PATHS.inventory);
    // Nothing to run: no constraints, run button or empty results, only
    // the current team's stat sheets and total.
    expect(within(card).queryByRole("button", { name: "Optimize" })).toBeNull();
    expect(within(card).queryAllByRole("group")).toHaveLength(0);
    expect(within(card).queryByText("No results yet")).toBeNull();
    expect(
      within(card).getByRole("article", { name: "Seele" })
    ).toBeInTheDocument();
    expect(card.querySelector("[data-damage-per-cycle]")?.textContent).toMatch(
      /\d/
    );
  }, 60_000);
});
