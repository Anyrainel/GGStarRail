import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemberOptions } from "@/components/damage/MemberOptions";
import { I18nProvider } from "@/i18n/I18nContext";
import { loadBuildReferences } from "@/lib/buildReferences";

describe("Team Damage member options", () => {
  it("designates an ally from the team", async () => {
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
    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("1102");
    expect(screen.getByRole("option", { name: "Seele" })).toBeInTheDocument();
    await userEvent.selectOptions(select, "1309");
    expect(onChange).toHaveBeenCalledWith({ character: { prayer: "1309" } });
  });
});
