import type { TeamPlan } from "@/domain/team/schemas";
import type { WorkspaceSources } from "./jobs";

/**
 * Finished analysis results for this session, so switching tabs or teams
 * keeps them. Memory only: results are never persisted.
 */
const results = new Map<string, unknown>();
const MAX_ENTRIES = 64;

const objectIds = new WeakMap<object, number>();
let nextObjectId = 1;

function objectId(value: object | null): number {
  if (!value) return 0;
  let id = objectIds.get(value);
  if (id === undefined) {
    id = nextObjectId;
    nextObjectId += 1;
    objectIds.set(value, id);
  }
  return id;
}

/**
 * A key that changes whenever the team, the workspace inputs, or the run
 * options change. The team's name is left out, so renaming keeps results.
 * Workspace objects are compared by identity: stores replace them on every
 * change.
 */
export function resultSignature(
  team: TeamPlan,
  sources: WorkspaceSources,
  options: unknown = null
): string {
  const { name: _name, ...inputs } = team;
  return [
    JSON.stringify(inputs),
    objectId(sources.account),
    objectId(sources.builds),
    objectId(sources.characterLightConeIds),
    JSON.stringify(options ?? null),
  ].join("|");
}

export function resultCacheKey(
  tab: string,
  mode: string,
  team: TeamPlan,
  sources: WorkspaceSources,
  options?: unknown
): string {
  return `${tab}:${mode}:${team.id}:${resultSignature(team, sources, options)}`;
}

export function readCachedResult<T>(key: string): T | undefined {
  return results.get(key) as T | undefined;
}

export function writeCachedResult<T>(key: string, value: T): void {
  results.delete(key);
  results.set(key, value);
  while (results.size > MAX_ENTRIES) {
    const oldest = results.keys().next().value;
    if (oldest === undefined) break;
    results.delete(oldest);
  }
}

/** Drops every result of a team, e.g. after it is deleted. */
export function forgetTeamResults(teamId: string): void {
  for (const key of [...results.keys()])
    if (key.split(":").slice(2).join(":").startsWith(`${teamId}:`))
      results.delete(key);
}

export function clearResultCache(): void {
  results.clear();
}
