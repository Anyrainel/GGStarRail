import type { AccountSnapshot } from "@/domain/game-account/schemas";
import { ownedCharacter } from "@/services/combat/accountTeam";
import { TEAM_DMG_TAB_ORDER, type TeamDmgTab } from "./types";

export type GridSortMode = "none" | "tier" | "release";

export interface GridViewState {
  query: string;
  combatTypes: Set<string>;
  paths: Set<string>;
  /** Null follows the default: on when account data exists. */
  ownedOnly: boolean | null;
  sort: GridSortMode;
}

/** Per-tab grid filters for this session (memory only, never persisted). */
const viewStates = new Map<TeamDmgTab, GridViewState>();

export function gridViewState(tab: TeamDmgTab): GridViewState {
  return (
    viewStates.get(tab) ?? {
      query: "",
      combatTypes: new Set(),
      paths: new Set(),
      ownedOnly: null,
      sort: "none",
    }
  );
}

export function saveGridViewState(tab: TeamDmgTab, state: GridViewState) {
  viewStates.set(tab, state);
}

export function ownedOnlyActive(
  state: GridViewState,
  account: AccountSnapshot | null
): boolean {
  return account !== null && (state.ownedOnly ?? true);
}

/**
 * Turns Owned only off in every Team DMG grid when a pick adds an unowned
 * Character, so the team just edited stays visible in whichever tab the user
 * opens next. Returns whether anything changed.
 */
export function releaseOwnedOnly(
  account: AccountSnapshot | null,
  characterId: string
): boolean {
  if (!account || ownedCharacter(account, characterId)) return false;
  let changed = false;
  for (const tab of TEAM_DMG_TAB_ORDER) {
    const state = gridViewState(tab);
    if (!ownedOnlyActive(state, account)) continue;
    viewStates.set(tab, { ...state, ownedOnly: false });
    changed = true;
  }
  return changed;
}
