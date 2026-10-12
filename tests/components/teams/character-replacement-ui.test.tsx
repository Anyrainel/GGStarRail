import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CharacterReplacementCard } from "@/components/teams/characters/CharacterReplacementCard";
import { RotationPanel } from "@/components/teams/rotation/RotationPanel";
import { emptyTeam } from "@/domain/team/schemas";
import { I18nProvider } from "@/i18n/I18nContext";

describe("Character replacement settings", () => {
  it("keeps calculation disabled and restores each mode's candidate scope", async () => {
    render(
      <I18nProvider>
        <CharacterReplacementCard team={emptyTeam("replacement-ui")} />
      </I18nProvider>
    );
    expect(screen.getByRole("button", { name: "Coming soon" })).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Candidates" }));
    await user.click(
      screen.getByRole("option", { name: "All characters + any Light Cones" })
    );
    fireEvent.click(screen.getByRole("radio", { name: "Replace unowned" }));
    expect(
      screen.getByRole("combobox", { name: "Candidates" })
    ).toHaveTextContent("Owned chars + owned LC");
    await user.click(screen.getByRole("combobox", { name: "Candidates" }));
    expect(
      screen.queryByRole("option", { name: "All characters + any Light Cones" })
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("option", { name: "Owned characters + any Light Cones" })
    );
    fireEvent.click(screen.getByRole("radio", { name: "Replace characters" }));
    expect(
      screen.getByRole("combobox", { name: "Candidates" })
    ).toHaveTextContent("All chars + any LC");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("defaults all Eidolon and Superimposition groups to account values", () => {
    render(
      <I18nProvider>
        <CharacterReplacementCard team={emptyTeam("replacement-ranks")} />
      </I18nProvider>
    );
    for (const name of [
      "4★ characters",
      "5★ characters",
      "3–4★ Light Cones",
      "5★ Light Cones",
    ])
      expect(screen.getByRole("combobox", { name })).toHaveTextContent(
        "Account"
      );
  });
});

describe("Rotation mode", () => {
  it("shows shared simulation running and failure states without opening a collapsed card", () => {
    const { rerender } = render(
      <I18nProvider>
        <RotationPanel result={null} running failed={false} />
      </I18nProvider>
    );
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(
      <I18nProvider>
        <RotationPanel result={null} running={false} failed />
      </I18nProvider>
    );
    expect(screen.getByRole("alert")).toBeVisible();
  });
});
