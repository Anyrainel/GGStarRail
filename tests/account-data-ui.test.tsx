import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { createDemoAccount } from "@/lib/demoAccount";
import InventoryView from "@/pages/account-data/InventoryView";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

function renderPage(page: ReactElement) {
  return render(
    <I18nProvider>
      <MemoryRouter>{page}</MemoryRouter>
    </I18nProvider>
  );
}

afterEach(() => {
  act(() => useWorkspaceStore.getState().clearWorkspace());
});

describe("Account Data source and lock-state presentation", () => {
  it("keeps partial source coverage prominent on the account overview", async () => {
    const account = await createDemoAccount(
      new Date("2026-09-02T12:00:00.000Z")
    );
    account.source.coverage = {
      characters: "complete",
      lightCones: "equipped-only",
      relics: "showcase-only",
    };
    useWorkspaceStore.getState().replaceAccount(account);

    renderPage(<InventoryView />);

    const coverage = screen.getByRole("region", {
      name: "Imported source coverage",
    });
    expect(coverage).toHaveTextContent(
      "does not represent a complete inventory"
    );
    expect(coverage).toHaveTextContent("Characters: Complete");
    expect(coverage).toHaveTextContent("Light Cones: Equipped only");
    expect(coverage).toHaveTextContent("Relics: Profile showcase only");
  });

  it("does not include unknown Light Cone locks in the unlocked filter", async () => {
    const account = await createDemoAccount();
    account.lightCones = account.lightCones.map((lightCone, index) => ({
      ...lightCone,
      locked: index === 0 ? null : false,
    }));
    useWorkspaceStore.getState().replaceAccount(account);
    const user = userEvent.setup();

    renderPage(<InventoryView />);
    const lightConeSection = screen
      .getByRole("heading", { name: "Light Cones" })
      .closest("section");
    if (!lightConeSection) throw new Error("Light Cone section missing");
    const status = await within(lightConeSection).findByRole("combobox", {
      name: "Status",
    });

    await user.selectOptions(status, "unknown-lock");
    await waitFor(() => {
      expect(
        lightConeSection.querySelectorAll("[data-item-lock='unknown']")
      ).toHaveLength(1);
    });

    await user.selectOptions(status, "unlocked");
    await waitFor(() => {
      expect(
        lightConeSection.querySelectorAll("[data-item-lock='unknown']")
      ).toHaveLength(0);
    });
  });

  it("exposes unknown Relic lock state as its own filter and icon marker", async () => {
    const account = await createDemoAccount();
    const cavernRelic = account.relics.find((relic) =>
      ["head", "hands", "body", "feet"].includes(relic.slot)
    );
    if (!cavernRelic) throw new Error("Expected a demo Cavern Relic");
    account.relics = account.relics.map((relic) => ({
      ...relic,
      locked: relic.key === cavernRelic.key ? null : false,
    }));
    useWorkspaceStore.getState().replaceAccount(account);
    const user = userEvent.setup();

    renderPage(<InventoryView />);
    const relicSection = screen
      .getByRole("heading", { name: "Relics and Planar Ornaments" })
      .closest("section");
    if (!relicSection) throw new Error("Relic section missing");
    const status = await within(relicSection).findByRole("combobox", {
      name: "Status",
    });
    await user.selectOptions(status, "unknown-lock");

    await waitFor(() => {
      expect(
        relicSection.querySelectorAll("[data-item-lock='unknown']")
      ).toHaveLength(1);
    });
    expect(
      within(status).getByRole("option", { name: "Lock state unknown" })
    ).toBeInTheDocument();
  });
});
