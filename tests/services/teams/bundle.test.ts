import { describe, expect, it } from "vitest";
import { emptyTeam, TeamMemberPlanSchema } from "@/domain/team/schemas";
import { loadBuildReferences } from "@/services/catalog/buildReferences";
import {
  createTeamWorkspaceBundle,
  parseTeamWorkspaceBundle,
  teamBundleReferenceIssue,
} from "@/services/teams/bundle";
import { loadTeamPreset } from "@/services/teams/presets";

function input() {
  return {
    teams: [emptyTeam("team:a")],
    activeTeamId: "team:a",
    analysisByTeamId: { "team:a": { mode: "investment" as const } },
  };
}

describe("team workspace bundles", () => {
  it("imports old v1 snapshots without inferring subscription and preserves v2 subscriptions", () => {
    const bundle = createTeamWorkspaceBundle(input());
    const { presetSubscription: _subscription, ...old } = bundle;
    expect(
      parseTeamWorkspaceBundle(JSON.stringify({ ...old, schemaVersion: 1 }))
        .presetSubscription
    ).toBeNull();
    const subscribed = createTeamWorkspaceBundle({
      ...input(),
      presetSubscription: {
        presetId: "flagship-teams",
        baseline: input().teams,
        deletedTeamIds: ["previously-deleted"],
      },
    });
    expect(parseTeamWorkspaceBundle(JSON.stringify(subscribed))).toEqual(
      subscribed
    );
  });
  it("accepts real slot-character analysis keys", async () => {
    const references = await loadBuildReferences();
    const bundle = createTeamWorkspaceBundle({
      ...input(),
      analysisByTeamId: {
        "team:a": {
          investment: {
            limits: { "0:1102": { eidolon: 4, superimposition: 3 } },
            budget: "perfect",
            critMode: "crit",
          },
        },
      },
    });
    expect(teamBundleReferenceIssue(bundle, references)).toBeNull();
  });
  it("round trips team plans and analysis choices", () => {
    const bundle = createTeamWorkspaceBundle(input());
    expect(parseTeamWorkspaceBundle(JSON.stringify(bundle))).toEqual(bundle);
  });
  it("rejects duplicate team IDs, dangling selections and analysis settings", () => {
    expect(() =>
      createTeamWorkspaceBundle({
        ...input(),
        teams: [emptyTeam("team:a"), emptyTeam("team:a")],
      })
    ).toThrow();
    expect(() =>
      createTeamWorkspaceBundle({ ...input(), activeTeamId: "missing" })
    ).toThrow();
    expect(() =>
      createTeamWorkspaceBundle({
        ...input(),
        analysisByTeamId: { missing: {} },
      })
    ).toThrow();
  });
  it("rejects duplicate trailblazer aliases and sensitive input", () => {
    const team = emptyTeam("team:a");
    team.members[0] = TeamMemberPlanSchema.parse({ characterId: "8005" });
    team.members[1] = TeamMemberPlanSchema.parse({ characterId: "8006" });
    expect(() =>
      createTeamWorkspaceBundle({ ...input(), teams: [team] })
    ).toThrow();
    expect(() =>
      parseTeamWorkspaceBundle(
        JSON.stringify({
          ...createTeamWorkspaceBundle(input()),
          cookie: "secret",
        })
      )
    ).toThrow();
  });
  it("validates all bundled flagship teams against released catalogs", async () => {
    const references = await loadBuildReferences();
    const { teams } = await loadTeamPreset("flagship-teams");
    const bundle = createTeamWorkspaceBundle({
      teams,
      activeTeamId: teams[0]?.id ?? null,
      analysisByTeamId: {},
    });
    expect(teamBundleReferenceIssue(bundle, references)).toBeNull();
    const first = bundle.teams[0]?.members[0];
    if (!first) throw new Error("Missing first preset");
    first.characterId = "does-not-exist";
    expect(teamBundleReferenceIssue(bundle, references)).toBe("does-not-exist");
  });
});
