import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { APP_PATHS } from "@/config/navigation";
import { ThemeProvider } from "@/contexts/ThemeContext";
import {
  createCharacterBuild,
  createCharacterScoreProfile,
} from "@/domain/build/configuration";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/lib/buildReferences";
import { createDemoAccount } from "@/lib/demoAccount";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

function renderRoute(path: string) {
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

async function prepareBuildWorkspace() {
  const [account, references] = await Promise.all([
    createDemoAccount(new Date("2026-09-02T00:00:00.000Z")),
    loadBuildReferences(),
  ]);
  const ownedCharacter = account.characters[0];
  if (!ownedCharacter) throw new Error("Demo character missing");
  const character = references.characters.byId.get(ownedCharacter.definitionId);
  if (!character) throw new Error("Character reference missing");
  const profile = createCharacterScoreProfile(
    character,
    references.progression,
    "Route test score",
    "score:route-test"
  );
  const build = createCharacterBuild(
    character,
    ownedCharacter.key,
    account.relics,
    references.relicSets.values,
    references.properties,
    references.progression,
    profile.id,
    "Route test build",
    "build:route-test"
  );
  useWorkspaceStore.getState().replaceAccount(account);
  useWorkspaceStore.getState().replaceBuildWorkspace({
    builds: [build],
    scoreProfiles: [profile],
    triageRules: useWorkspaceStore.getState().triageRules,
  });
}

function metricValue(label: string): number {
  const labelNode = screen.getByText(label);
  const value = labelNode.nextElementSibling?.textContent;
  if (value === undefined || value === null) {
    throw new Error(`Metric value missing for ${label}`);
  }
  return Number(value);
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}

afterEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
});

describe("Build Lab route interactions", () => {
  it("edits scoring and presents equipped filter acceptance", async () => {
    await prepareBuildWorkspace();
    const user = userEvent.setup();
    renderRoute(APP_PATHS.scoring);

    await screen.findByText("Profile settings");
    expect(
      screen.getByText(/All six meet filter criteria|Filter criteria not met/)
    ).toBeVisible();
    expect(
      screen.getByText("Equipped loadout · Route test build")
    ).toBeVisible();

    const hpFlat = screen.getByRole("slider", { name: "HP" });
    const hpRatio = screen.getByRole("slider", { name: "HP%" });
    expect(screen.getByRole("slider", { name: "ATK" })).toBeVisible();
    expect(screen.getByRole("slider", { name: "ATK%" })).toBeVisible();
    expect(screen.getByRole("slider", { name: "DEF" })).toBeVisible();
    expect(screen.getByRole("slider", { name: "DEF%" })).toBeVisible();
    expect(hpFlat).not.toBe(hpRatio);
    fireEvent.change(hpRatio, { target: { value: "77" } });
    await waitFor(() => {
      expect(
        useWorkspaceStore.getState().scoreProfiles[0]?.statWeights.HPAddedRatio
      ).toBe(0.77);
    });

    const profileName = screen.getByRole("textbox", { name: "Profile name" });
    await user.clear(profileName);
    await user.type(profileName, "Edited route score");
    await user.tab();

    await waitFor(() => {
      expect(useWorkspaceStore.getState().scoreProfiles[0]?.name).toBe(
        "Edited route score"
      );
    });
  });

  it("keeps scoring editable and offers the account handoff without account data", async () => {
    await prepareBuildWorkspace();
    act(() => useWorkspaceStore.setState({ account: null }));
    renderRoute(APP_PATHS.scoring);

    expect(await screen.findByText("Profile settings")).toBeVisible();
    expect(
      screen.getByText(
        "This scoring profile is ready. Import an account to score inventory Relics and evaluate the equipped build."
      )
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Import account" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Load demo account" })
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Data source details" })
    ).toHaveAttribute("href", APP_PATHS.imports);
    expect(screen.queryByText("Scored Relics")).not.toBeInTheDocument();
  });

  it("switches a derived slot filter and opens the full recommendation view", async () => {
    await prepareBuildWorkspace();
    const user = userEvent.setup();
    renderRoute(APP_PATHS.filters);

    expect(await screen.findByText("6 derived slot filters")).toBeVisible();
    expect(screen.getByText("Recommended loadout")).toBeVisible();

    const bodyRule = screen.getByRole("button", {
      name: /^Body .*matches/,
    });
    await user.click(bodyRule);
    expect(bodyRule).toHaveAttribute("aria-pressed", "true");
    expect(within(bodyRule).getByText("Desired substats")).toBeVisible();
    expect(within(bodyRule).getByText("Must-have substats")).toBeVisible();

    const matchesOnly = screen.getByRole("checkbox", {
      name: /Show matches only/,
    });
    await user.click(matchesOnly);
    expect(matchesOnly).not.toBeChecked();
    expect(
      screen.getAllByText(/Matches|Does not match/).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Wrong slot").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/HP%|ATK%|DEF%/).length).toBeGreaterThan(0);
  });

  it("updates triage thresholds and filters the explained decisions", async () => {
    await prepareBuildWorkspace();
    const user = userEvent.setup();
    renderRoute(APP_PATHS.triage);

    const keepThreshold = await screen.findByRole("spinbutton", {
      name: "Keep at or above",
    });
    fireEvent.change(keepThreshold, { target: { value: "95" } });
    await waitFor(() => {
      expect(useWorkspaceStore.getState().triageRules.keepScoreAtLeast).toBe(
        95
      );
    });

    const salvageFilter = screen.getByRole("button", {
      name: /^Salvage review/,
    });
    await user.click(salvageFilter);
    expect(salvageFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Triage results")).toBeVisible();
  });

  it("previews per-reason manager actionability before downloading review JSON", async () => {
    await prepareBuildWorkspace();
    const user = userEvent.setup();
    const createObjectURL = vi.fn((_blob: Blob) => "blob:manager-preview");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    renderRoute(APP_PATHS.triage);

    const download = await screen.findByRole("button", {
      name: "Download instructions",
    });
    expect(download).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Prepare preview" }));
    await waitFor(() => expect(download).toBeEnabled());

    const instructionCount = metricValue("Instructions");
    expect(instructionCount).toBeGreaterThan(0);
    expect(metricValue("Preview only")).toBe(instructionCount);
    expect(metricValue("Actionable")).toBe(0);
    expect(metricValue("Unknown prior state")).toBe(instructionCount);
    expect(metricValue("Equipped pieces")).toBeGreaterThan(0);
    expect(metricValue("Ambiguous matchers")).toBe(0);
    expect(screen.getByText(/reason counts can overlap/i)).toBeInTheDocument();

    await user.click(download);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:manager-preview");
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);

    const managerCard = screen
      .getByText("GOODScanner manager preview")
      .closest("div.overflow-hidden");
    expect(managerCard).not.toBeNull();
    expect(
      within(managerCard as HTMLElement).getByText(/never changes the game/i)
    ).toBeVisible();
  });

  it("shows locked discard candidates as preview-only with protection disabled", async () => {
    await prepareBuildWorkspace();
    const state = useWorkspaceStore.getState();
    const account = state.account;
    if (!account) throw new Error("Prepared account missing");
    const candidate = account.relics.find(
      (relic) => !relic.equippedCharacterKey && relic.discarded !== true
    );
    if (!candidate) throw new Error("Unequipped demo Relic missing");
    state.replaceAccount({
      ...account,
      relics: account.relics.map((relic) =>
        relic.key === candidate.key
          ? { ...relic, setId: "manager-locked-guard", locked: true }
          : relic
      ),
      source: { ...account.source, provider: "scanner-export" },
    });
    state.setTriageRules({ ...state.triageRules, protectLocked: false });

    const user = userEvent.setup();
    let downloadedBlob: Blob | null = null;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        downloadedBlob = blob;
        return "blob:locked-discard-guard";
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined
    );
    renderRoute(APP_PATHS.triage);
    expect(
      await screen.findByRole("checkbox", { name: /^Protect locked Relics/ })
    ).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Prepare preview" }));

    await waitFor(() => {
      expect(metricValue("Locked before discard")).toBe(1);
    });
    const previewInstructionCount = metricValue("Instructions");
    expect(metricValue("Preview only")).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/counted in this preview but omitted from the download/i)
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Download instructions" })
    );
    expect(downloadedBlob).toBeInstanceOf(Blob);
    const downloaded = JSON.parse(
      await readBlobText(downloadedBlob as unknown as Blob)
    ) as {
      instructions: {
        before: { lock: boolean | null };
        desired: { discard?: boolean };
      }[];
    };
    expect(
      downloaded.instructions.some(
        ({ before, desired }) =>
          before.lock === true && desired.discard === true
      )
    ).toBe(false);
    expect(downloaded.instructions).toHaveLength(previewInstructionCount - 1);
  });
});
