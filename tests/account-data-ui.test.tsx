import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { createDemoAccount } from "@/lib/demoAccount";
import InventoryPage from "@/pages/account/InventoryPage";
import LightConesPage from "@/pages/account/LightConesPage";
import RelicsPage from "@/pages/account/RelicsPage";
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

    renderPage(<InventoryPage />);

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

    renderPage(<LightConesPage />);
    const status = await screen.findByRole("combobox", { name: "Status" });

    await user.selectOptions(status, "unknown-lock");
    await waitFor(() => {
      expect(screen.getAllByText("Lock state unknown")).toHaveLength(2);
    });

    await user.selectOptions(status, "unlocked");
    await waitFor(() => {
      expect(screen.getAllByText("Lock state unknown")).toHaveLength(1);
    });
  });

  it("exposes unknown Relic lock state as its own filter and badge", async () => {
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

    renderPage(
      <RelicsPage
        category="cavern"
        titleKey="route.relics.title"
        descriptionKey="route.relics.description"
        emptyKey="empty.relics"
      />
    );
    const status = await screen.findByRole("combobox", { name: "Status" });
    await user.selectOptions(status, "unknown-lock");

    await waitFor(() => {
      const unknownLabels = screen.getAllByText("Lock state unknown");
      expect(unknownLabels.length).toBeGreaterThan(1);
    });
    expect(
      within(status).getByRole("option", { name: "Lock state unknown" })
    ).toBeInTheDocument();
  });
});
