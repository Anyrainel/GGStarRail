import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemberOptions } from "@/components/team-analysis/MemberOptions";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/services/catalog/buildReferences";

describe("Team DMG member options", () => {
  it("designates an ally from the team", async () => {
    const user = userEvent.setup();
    const references = await loadBuildReferences();
    const character = references.characters.byId.get("1225");
    if (!character) throw new Error("Missing Fugue");
    const onChange = vi.fn();
    render(
      <I18nProvider>
        <MemberOptions
          character={character}
          references={references}
          groups={[
            {
              entity: "character",
              entityId: "1225",
              options: [
                {
                  id: "prayer",
                  origin: "talent",
                  condition: "ally",
                  defaultValue: "1102",
                  choices: ["1102", "1309"],
                },
              ],
            },
          ]}
          values={{}}
          onChange={onChange}
        />
      </I18nProvider>
    );
    const group = screen.getByRole("group", { name: "Conditions" });
    const select = screen.getByRole("combobox", { name: /Talent/ });
    expect(group).toContainElement(select);
    expect(select).toHaveTextContent("Seele");
    await user.click(select);
    await user.click(await screen.findByRole("option", { name: "Robin" }));
    expect(onChange).toHaveBeenCalledWith({ character: { prayer: "1309" } });
  });

  it("renders one row per option with switches and numbers", async () => {
    const user = userEvent.setup();
    const references = await loadBuildReferences();
    const character = references.characters.byId.get("1102");
    if (!character) throw new Error("Missing Seele");
    const onChange = vi.fn();
    render(
      <I18nProvider>
        <MemberOptions
          character={character}
          references={references}
          groups={[
            {
              entity: "character",
              entityId: "1102",
              options: [
                {
                  id: "resurgence",
                  origin: "talent",
                  condition: "active",
                  defaultValue: false,
                },
                {
                  id: "stacks",
                  origin: "skill",
                  condition: "stacks",
                  defaultValue: 1,
                  max: 2,
                },
              ],
            },
          ]}
          values={{}}
          onChange={onChange}
        />
      </I18nProvider>
    );
    const toggle = screen.getByRole("switch", { name: /Talent/ });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith({
      character: { resurgence: true },
    });
    const stacks = screen.getByRole("spinbutton", { name: /Stacks/ });
    await user.clear(stacks);
    await user.type(stacks, "5{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ character: { stacks: 2 } });
  });

  it("renders nothing without options", async () => {
    const references = await loadBuildReferences();
    const character = references.characters.byId.get("1102");
    if (!character) throw new Error("Missing Seele");
    const { container } = render(
      <I18nProvider>
        <MemberOptions
          character={character}
          references={references}
          groups={[{ entity: "character", entityId: "1102", options: [] }]}
          values={{}}
          onChange={vi.fn()}
        />
      </I18nProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });
});
